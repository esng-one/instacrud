# api/system_dto.py

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from instacrud.model.system_model import Role

# ------------------------------
# REQUEST MODELS
# ------------------------------

class OrganizationCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    tier_id: Optional[str] = None
    local_only_conversations: bool = False

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tier_id: Optional[str] = None
    local_only_conversations: Optional[bool] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str
    role: Role = Role.USER
    organization_id: Optional[str] = None
    invitation_id: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    name: Optional[str] = None
    role: Optional[Role] = None
    organization_id: Optional[str] = None

class InviteUserCreate(BaseModel):
    email: EmailStr
    role: Role = Role.USER
    organization_id: Optional[str] = None
    expires_in_seconds: int = 7 * 24 * 60 * 60

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class UserSettingsUpdate(BaseModel):
    local_only_conversations: Optional[bool] = None

class UserSettingsResponse(BaseModel):
    local_only_conversations: bool
    user_local_only_conversations: Optional[bool] = None

# ------------------------------
# RESPONSE MODELS
# ------------------------------

class MessageResponse(BaseModel):
    message: str

class InvitationResponse(MessageResponse):
    invitation_id: str

class SignupResponse(MessageResponse):
    user_id: str

class OrganizationResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    status: str = "ACTIVE"
    tier_id: Optional[str] = None
    local_only_conversations: bool = False

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    role: Role
    organization_id: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class InvitationListResponse(BaseModel):
    id: str
    organization_id: str
    invited_by: str
    invited_at: datetime
    expires_at: datetime
    role: Role
    accepted: bool

class DeleteOrgConfirmResponse(BaseModel):
    message: str
    org_name_hash: str
