# ai/usage_tracker.py

from datetime import datetime, timedelta, timezone
from typing import Optional
from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError
from instacrud.model.system_model import Usage, UsageHistory, User, Tier, Organization
from instacrud.config import settings


class UsageLimitExceeded(Exception):
    """Exception raised when usage limit is exceeded."""
    def __init__(self, message: str, reset_at: datetime):
        self.message = message
        self.reset_at = reset_at
        super().__init__(self.message)


class TierAccessDenied(Exception):
    """Exception raised when user's tier doesn't have access to the requested model."""
    def __init__(self, message: str, required_tier: int, user_tier: int):
        self.message = message
        self.required_tier = required_tier
        self.user_tier = user_tier
        super().__init__(self.message)


class UsageTracker:
    """
    Handles atomic usage tracking with organization-based tier limits and TTL-based resets.
    Usage is tied to organizations - all users in an organization share the same usage pool.
    """

    @staticmethod
    async def rollover_usage(usage: Usage) -> None:
        """
        Persist the expired usage document to UsageHistory and delete it.

        Args:
            usage: The expired Usage document to rollover
        """
        # Create history record
        history = UsageHistory(
            organization_id=usage.organization_id,
            tier_id=usage.tier_id,
            usage=usage.usage,
            period_start=usage.created_at,
            period_end=usage.reset_at
        )
        await history.insert()

        # Delete the old usage document
        await usage.delete()

    @staticmethod
    async def check_and_rollover_usage(organization_id: PydanticObjectId, tier_id: Optional[PydanticObjectId] = None) -> Optional[Usage]:
        """
        Check if usage exists and rollover if expired, but don't create a new document.

        Args:
            organization_id: Organization's MongoDB ObjectId
            tier_id: Optional tier ID

        Returns:
            Usage document if exists and not expired, None otherwise
        """
        usage = await Usage.find_one({"organization_id": organization_id, "tier_id": tier_id})

        if usage:
            now = datetime.now(tz=timezone.utc)
            reset_at = usage.reset_at
            if reset_at.tzinfo is None:
                reset_at = reset_at.replace(tzinfo=timezone.utc)
            if reset_at <= now:
                # Window expired - rollover to history and return None
                await UsageTracker.rollover_usage(usage)
                return None

        return usage

    @staticmethod
    async def get_or_create_usage(organization_id: PydanticObjectId, tier_id: Optional[PydanticObjectId] = None) -> Usage:
        """
        Get or create a usage document for the organization.
        If the document exists but has expired, perform rollover to history
        and create a fresh usage document.

        Args:
            organization_id: Organization's MongoDB ObjectId
            tier_id: Optional tier ID (defaults to organization's tier)

        Returns:
            Usage document
        """
        # Find existing usage document
        usage = await Usage.find_one({"organization_id": organization_id, "tier_id": tier_id})

        if usage:
            # Check if window has expired
            now = datetime.now(tz=timezone.utc)
            reset_at = usage.reset_at
            # Ensure reset_at is timezone-aware for comparison
            if reset_at.tzinfo is None:
                reset_at = reset_at.replace(tzinfo=timezone.utc)
            if reset_at <= now:
                # Window expired - rollover to history and create fresh document
                await UsageTracker.rollover_usage(usage)
                usage = None  # Fall through to create new document

        if usage:
            return usage

        # Create new usage document
        now = datetime.now(tz=timezone.utc)
        reset_at = now + timedelta(seconds=settings.USAGE_RESET_PERIOD_SECONDS)

        usage = Usage(
            organization_id=organization_id,
            tier_id=tier_id,
            reset_at=reset_at,
            created_at=now
        )

        try:
            await usage.insert()
        except DuplicateKeyError:
            # Race condition: another process created it, fetch it
            usage = await Usage.find_one({"organization_id": organization_id, "tier_id": tier_id})
            if not usage:
                raise RuntimeError("Failed to create or fetch usage document")

        return usage

    @staticmethod
    async def get_organization_tier(organization_id: PydanticObjectId) -> Optional[Tier]:
        """
        Get the organization's tier configuration.

        Args:
            organization_id: Organization's MongoDB ObjectId

        Returns:
            Tier document or None if organization has no tier assigned
        """
        org = await Organization.get(organization_id)
        if not org:
            return None

        tier_id = getattr(org, 'tier_id', None)
        if not tier_id:
            return None

        return await Tier.get(tier_id)

    @staticmethod
    async def check_tier_access(user_id: PydanticObjectId, model_tier: Optional[int]) -> None:
        """
        Check if the user's organization tier has access to a model with the given tier.

        A model is accessible if:
        - The model has no tier requirement (model_tier is None)
        - The user's organization has no tier (unlimited access)
        - The organization's tier level is >= the model's tier requirement

        Args:
            user_id: User's MongoDB ObjectId
            model_tier: The tier level required by the model (None = available to all)

        Raises:
            TierAccessDenied: If the user's tier doesn't have access to the model
        """
        # If model has no tier requirement, it's available to everyone
        if model_tier is None:
            return

        # Get user's organization
        organization_id = await UsageTracker.get_user_organization_id(user_id)
        if not organization_id:
            # User has no organization - allow access (or could deny, depending on policy)
            return

        # Get organization's tier
        org_tier = await UsageTracker.get_organization_tier(organization_id)
        if not org_tier:
            # Organization has no tier assigned - allow access (unlimited)
            return

        # Check if organization's tier level is sufficient
        if org_tier.tier < model_tier:
            raise TierAccessDenied(
                f"Model requires tier {model_tier} but organization has tier {org_tier.tier} ({org_tier.name}). "
                f"Please upgrade your plan to access this model.",
                required_tier=model_tier,
                user_tier=org_tier.tier
            )

    @staticmethod
    async def get_user_organization_id(user_id: PydanticObjectId) -> Optional[PydanticObjectId]:
        """
        Get the user's organization ID.

        Args:
            user_id: User's MongoDB ObjectId

        Returns:
            Organization ID or None if user has no organization
        """
        user = await User.get(user_id)
        if not user:
            return None

        return user.organization_id

    @staticmethod
    async def check_and_increment_usage(
        user_id: PydanticObjectId,
        cost: float,
        tier_id: Optional[PydanticObjectId] = None
    ) -> Optional[Usage]:
        """
        Check if the organization has enough usage quota and atomically increment usage.

        Uses MongoDB's findOneAndUpdate with $inc for atomic increment to prevent race conditions.
        Validates the limit BEFORE incrementing to ensure we don't exceed it.

        Args:
            user_id: User's MongoDB ObjectId (used to get organization)
            cost: Credits to consume
            tier_id: Optional tier ID

        Returns:
            Updated Usage document

        Raises:
            UsageLimitExceeded: If the usage would exceed the organization's tier limit
        """
        # Get user's organization
        organization_id = await UsageTracker.get_user_organization_id(user_id)
        if not organization_id:
            # User has no organization - skip usage tracking
            return None

        # Get or create usage document for organization
        usage = await UsageTracker.get_or_create_usage(organization_id, tier_id)

        # Get organization's tier limits
        tier = await UsageTracker.get_organization_tier(organization_id)

        current_usage = usage.usage

        # Get limit from tier (None means unlimited)
        limit = None
        if tier:
            limit = tier.usage

        # Check if increment would exceed limit
        if limit is not None:
            new_usage = current_usage + cost
            if new_usage > limit:
                raise UsageLimitExceeded(
                    f"Organization usage limit exceeded. "
                    f"Current: {current_usage:.6f}, Requested: {cost:.6f}, Limit: {limit:.2f}. "
                    f"Usage will reset at {usage.reset_at.strftime('%Y-%m-%d %H:%M:%S UTC')}.",
                    reset_at=usage.reset_at
                )

        # Atomic increment using MongoDB's $inc operator
        # This ensures thread-safety and prevents race conditions
        updated_usage = await usage.find_one(
            {"_id": usage.id}
        ).update(
            {"$inc": {"usage": cost}},
            response_type="after"  # Return the updated document
        )

        if not updated_usage:
            raise RuntimeError("Failed to update usage document")

        return updated_usage

    @staticmethod
    async def get_organization_usage_stats(organization_id: PydanticObjectId) -> Optional[dict]:
        """
        Get current usage statistics for a specific organization.

        Args:
            organization_id: Organization's MongoDB ObjectId

        Returns:
            Dictionary with organization usage stats and limits, or None if org not found
        """
        # Get organization details
        org = await Organization.get(organization_id)
        if not org:
            return None

        # Check usage and rollover if expired (don't create new document)
        usage = await UsageTracker.check_and_rollover_usage(organization_id)
        tier = await UsageTracker.get_organization_tier(organization_id)

        # If no usage exists (or was rolled over), return zeroed stats
        used = usage.usage if usage else 0
        limit = tier.usage if tier else None
        reset_at = usage.reset_at if usage else datetime.now(tz=timezone.utc) + timedelta(seconds=settings.USAGE_RESET_PERIOD_SECONDS)

        # Calculate percentage
        percentage = 0.0
        if limit is not None and limit > 0:
            percentage = (used / limit) * 100
        elif limit is None:
            # For unlimited, calculate percentage based on 0.40 credits max
            percentage = (used / 0.4) * 100

        return {
            "organization_id": str(organization_id),
            "organization_name": org.name,
            "tier_name": tier.name if tier else "No Tier",
            "reset_at": reset_at.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
            "usage": {
                "used": used,
                "limit": limit,
                "percentage": min(percentage, 100),
                "remaining": (limit - used) if limit is not None else None
            }
        }

    @staticmethod
    async def get_usage_stats(user_id: PydanticObjectId) -> dict:
        """
        Get current usage statistics for a user's organization.

        Args:
            user_id: User's MongoDB ObjectId

        Returns:
            Dictionary with organization usage stats and limits
        """
        # Get user's organization
        organization_id = await UsageTracker.get_user_organization_id(user_id)

        if not organization_id:
            # User has no organization, return empty stats
            reset_at = datetime.now(tz=timezone.utc) + timedelta(seconds=settings.USAGE_RESET_PERIOD_SECONDS)
            return {
                "user_id": str(user_id),
                "organization_id": None,
                "organization_name": None,
                "tier_name": "No Tier",
                "reset_at": reset_at.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
                "usage": {
                    "used": 0,
                    "limit": None,
                    "percentage": 0,
                    "remaining": None
                }
            }

        # Get organization stats and add user_id
        stats = await UsageTracker.get_organization_usage_stats(organization_id)
        stats["user_id"] = str(user_id)
        return stats

