# api/me_dto.py

from typing import Optional
from pydantic import BaseModel, EmailStr


class MeUserInfo(BaseModel):
    id: str
    email: str
    name: Optional[str]
    role: str
    has_password: bool


class MeOrgInfo(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str]


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
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    # local_only_conversations excluded — handled by PATCH /user-settings
