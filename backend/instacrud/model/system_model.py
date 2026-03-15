# model/system_model.py

from beanie import Document, Indexed, Insert, PydanticObjectId, Save, before_event
from pydantic import BaseModel, Field, EmailStr, field_serializer, field_validator
from pymongo import IndexModel
from datetime import datetime, timezone
from typing import Annotated, Optional
from enum import Enum
from instacrud.context import current_user_context
from instacrud.api.validators import NormalizeInputMixin, CreditValidatorMixin, UtcDatetimeMixin

class RootModel(Document, NormalizeInputMixin, UtcDatetimeMixin):
    """
    Base Beanie model:
      - Normalizes blank inputs globally
      - Enforces valid date ranges
      - Adds created/updated metadata automatically
    """

    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))
    created_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))
    updated_by: Optional[str] = None

    class Settings:
        use_state_management = True
        validate_on_save = True

    @field_serializer('created_at', 'updated_at')
    def serialize_utc_datetime(self, v: datetime) -> str:
        return v.replace(tzinfo=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f') + 'Z'

    @before_event(Insert)
    async def populate_create_fields(self):
        now = datetime.now(tz=timezone.utc)
        self.created_at = now
        self.updated_at = now

        user_ctx = current_user_context.get()
        if user_ctx and user_ctx.email:
            self.created_by = user_ctx.email
            self.updated_by = user_ctx.email

    @before_event(Save)
    async def populate_update_fields(self):
        self.updated_at = datetime.now(tz=timezone.utc)

        user_ctx = current_user_context.get()
        if user_ctx and user_ctx.email:
            self.updated_by = user_ctx.email

# ----------------------------
# System-Level Models
# ----------------------------

class Organization(RootModel):
    name: Annotated[str, Indexed()]
    code: Annotated[str, Indexed(unique=True)]
    description: Optional[str] = None
    mongo_url: Optional[str] = None
    status: str = Field(default="ACTIVE")
    tier_id: Annotated[Optional[PydanticObjectId], Indexed()] = None
    local_only_conversations: bool = False  # If true, don't sync conversations to server

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v):
        if v is None:
            return "ACTIVE"
        return v

    class Settings:
        name = "organizations"

class Role(str, Enum):
    ADMIN = "ADMIN"
    ORG_ADMIN = "ORG_ADMIN"
    USER = "USER"
    RO_USER = "RO_USER"

class User(RootModel):
    email: Annotated[EmailStr, Indexed(unique=True)]
    hashed_password: Optional[str] = None
    name: Optional[str] = None
    role: Role = Role.USER
    organization_id: Annotated[Optional[PydanticObjectId], Indexed()] = None
    tier_id: Annotated[Optional[PydanticObjectId], Indexed()] = None
    local_only_conversations: Optional[bool] = None  # None means use org setting

    class Settings:
        name = "users"

    async def save(self, *args, **kwargs):
        self.email = self.email.lower()
        return await super().save(*args, **kwargs)

class CurrentUserContext(BaseModel):
    user_id: Optional[PydanticObjectId] = None
    email: Optional[str] = None
    role: Optional[Role] = None
    organization_id: Optional[str] = None

class Invitation(RootModel):
    organization_id: Annotated[PydanticObjectId, Indexed()]
    invited_by: Annotated[PydanticObjectId, Indexed()]
    invited_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))
    expires_at: Annotated[datetime, Indexed()]
    role: Role = Role.USER
    accepted: bool = False

    class Settings:
        name = "invitations"

class PasswordResetToken(RootModel):
    user_id: Annotated[PydanticObjectId, Indexed()]
    token: Annotated[str, Indexed()]  # Hashed token
    expires_at: Annotated[datetime, Indexed()]
    used: bool = False

    class Settings(RootModel.Settings):
        name = "password_reset_tokens"
        indexes = [
            IndexModel([("expires_at", 1)], expireAfterSeconds=0)  # TTL index
        ]

class AiServiceProvider(str, Enum):
    OPEN_AI = "OPEN_AI"
    DEEP_INFRA = "DEEP_INFRA"
    CLAUDE = "CLAUDE"
    OLLAMA = "OLLAMA"

class AiModel(RootModel, CreditValidatorMixin):
    service: Annotated[AiServiceProvider, Indexed()]
    name: Annotated[str, Indexed()]
    model_identifier: Annotated[str, Indexed(unique=True)]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = 16384
    credits: Optional[int] = None
    input_tokens_cost: Optional[float] = None
    output_tokens_cost: Optional[float] = None
    completion: bool = True
    embedding: bool = False
    image_completion: bool = False
    image_generation: bool = False
    reasoning: bool = False
    enabled: bool = True
    rank: Optional[int] = 50
    params: Optional[dict] = None
    tier: Optional[int] = None
    icon: Optional[str] = None

    class Settings:
        name = "ai_models"

class Tier(RootModel):
    tier: Annotated[int, Indexed(unique=True)]
    name: Annotated[str, Indexed()]
    code: Annotated[str, Indexed(unique=True)]
    description: Optional[str] = None
    usage: Optional[float] = None  # Max usage in credits (None = unlimited)
    cost: Optional[float] = None
    active: bool = True

    class Settings:
        name = "tiers"

# ----------------------------
# Usage Tracking (with TTL)
# ----------------------------

class Usage(Document):
    """
    Tracks AI model usage per organization for the current billing window.

    Usage is calculated as credits:
    - For completions: (input_tokens * input_cost + output_tokens * output_cost) / 1,000,000
    - For embeddings: (tokens * input_cost) / 1,000,000
    - For images: quantity * input_cost

    When reset_at expires, the usage is explicitly rolled over to UsageHistory
    and a fresh Usage document is created. TTL (30 days) serves as cleanup for
    orphaned documents only.

    Usage is tied to organizations - all users in an organization share the same
    usage pool. If the organization exhausts its usage, all users are blocked.
    """
    organization_id: Annotated[PydanticObjectId, Indexed()]
    tier_id: Annotated[Optional[PydanticObjectId], Indexed()] = None

    # Usage counter in credits
    usage: float = 0.0

    # Window expiration: when this is in the past, rollover to history
    reset_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "usage"
        indexes = [
            IndexModel(
                [("organization_id", 1), ("tier_id", 1)],
                unique=True,
                name="org_tier_unique"
            ),
            # TTL set to 30 days as safety cleanup for orphaned documents
            IndexModel(
                [("reset_at", 1)],
                expireAfterSeconds=30 * 24 * 60 * 60,  # 30 days
                name="reset_at_ttl"
            )
        ]


class UsageHistory(Document):
    """
    Historical record of usage per billing period.

    Created when a Usage document's window expires and is rolled over.
    Preserves the full usage record for reporting and auditing.
    """
    organization_id: Annotated[PydanticObjectId, Indexed()]
    tier_id: Annotated[Optional[PydanticObjectId], Indexed()] = None

    # Final usage for the period in credits
    usage: float = 0.0

    # The billing period this record covers
    period_start: datetime
    period_end: datetime

    # When this history record was created
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "usage_history"
        indexes = [
            IndexModel(
                [("organization_id", 1), ("period_end", -1)],
                name="org_period_lookup"
            ),
            IndexModel(
                [("organization_id", 1), ("tier_id", 1), ("period_end", -1)],
                name="org_tier_period_lookup"
            )
        ]

# ----------------------------
# OAuth Sessions (short-lived)
# ----------------------------

class OAuthSession(Document):
    session_code: str
    token: str
    # TTL index: MongoDB removes document once expires_at < now
    expires_at: datetime = Indexed(expiresAfterSeconds=0)

    class Settings:
        name = "oauth_sessions"