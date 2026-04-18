# api/me_dto.py

from typing import Optional
from pydantic import BaseModel, ConfigDict
from instacrud.api.validators import DescriptionStr, NameStr


class MeUserInfo(BaseModel):
    id: str
    email: str
    name: Optional[str]
    role: str
    has_password: bool


class MeOrgInfo(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str


class MeUsageInfo(BaseModel):
    used: float
    limit: Optional[float]
    percentage: float
    remaining: Optional[float]
    reset_at: str  # pre-formatted string from UsageTracker, e.g. "2026-04-04T12:00:00.000Z"


class MeTierInfo(BaseModel):
    name: str
    code: str
    level: int


class MeResponse(BaseModel):
    user: MeUserInfo
    organization: Optional[MeOrgInfo]  # None if user has no org
    usage: MeUsageInfo
    tier: Optional[MeTierInfo]  # None if no tier assigned


class MeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: NameStr


class MeOrganizationResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str]
    local_only_conversations: bool
    tier_id: Optional[str]  # read-only; None if no tier assigned to the org


class MeOrganizationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[NameStr] = None
    description: Optional[DescriptionStr] = None
    local_only_conversations: Optional[bool] = None
