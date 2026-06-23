# instacrud/api/organization_dto.py

from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from beanie import PydanticObjectId
from instacrud.model.organization_model import ClientType, ConversationMessage


# Shared UTC serializer for all XxxListItem projection models.
# RootModel carries its own serializer; plain-BaseModel projections bypass it,
# so each DTO delegates here instead of copying the format string.
def _serialize_utc_dt(v: Optional[datetime]) -> Optional[str]:
    if v is None:
        return None
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)  # Motor returns naive UTC
    else:
        v = v.astimezone(timezone.utc)  # normalise any non-UTC zone
    return v.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"


class _ListItemBase(BaseModel):
    """Shared base for all list-projection DTOs.

    Provides the UTC datetime validator + serializer so subclasses don't
    copy the same block. Beanie projects each subclass independently;
    RootModel's UtcDatetimeMixin does not apply to plain-BaseModel projections.
    """
    model_config = ConfigDict(populate_by_name=True)

    updated_at: Optional[datetime] = None

    @field_validator("updated_at", mode="before")
    @classmethod
    def _attach_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @field_serializer("updated_at")
    def _serialize_dt(self, v: Optional[datetime]) -> Optional[str]:
        return _serialize_utc_dt(v)


class ClientListItem(_ListItemBase):
    """Projection model for GET /clients list — only fields rendered by ClientGrid.

    Intentionally omits: search_tokens (internal full-text index, never rendered),
    contact_ids, address_ids (ID arrays unused by the grid).
    """
    id: Optional[PydanticObjectId] = Field(None, alias="_id")
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[ClientType] = None
    description: Optional[str] = None


class ProjectListItem(_ListItemBase):
    """Projection model for GET /projects list — only fields rendered by ProjectGrid.

    Intentionally omits: search_tokens (internal full-text index, never rendered).
    client_id is included for the client reference field hook.
    """
    id: Optional[PydanticObjectId] = Field(None, alias="_id")
    code: Optional[str] = None
    name: Optional[str] = None
    client_id: Optional[PydanticObjectId] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    description: Optional[str] = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def _attach_utc_dates(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    @field_serializer("start_date", "end_date")
    def _serialize_dates(self, v: Optional[datetime]) -> Optional[str]:
        return _serialize_utc_dt(v)


class ContactListItem(_ListItemBase):
    """Projection model for GET /contacts list — only fields rendered by ContactGrid.

    Intentionally omits: search_tokens (internal full-text index, never rendered).
    """
    id: Optional[PydanticObjectId] = Field(None, alias="_id")
    name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ProjectDocumentListItem(_ListItemBase):
    """Projection model for GET /documents list — only fields rendered by DocumentGrid.

    Intentionally omits: search_tokens (internal full-text index, never rendered),
    content_embedding (1536-dim float array; not needed in list — heatmap only
    renders in expanded accordion, which can lazy-load from the detail endpoint).
    """
    id: Optional[PydanticObjectId] = Field(None, alias="_id")
    project_id: Optional[PydanticObjectId] = None
    code: Optional[str] = None
    name: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None


class Entity(BaseModel):
    api: str
    id: str
    name: str


class Find(BaseModel):
    entities: List[Entity]


class ConversationCreate(BaseModel):
    external_uuid: Optional[str] = None
    title: Optional[str] = None
    messages: List[ConversationMessage] = []
    model_id: Optional[str] = None
    last_message_at: Optional[datetime] = None
    system_prompt: Optional[str] = None
    path: Optional[str] = None
    context: Optional[str] = None
    tools: Optional[str] = None
 