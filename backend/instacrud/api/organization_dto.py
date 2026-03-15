# instacrud/api/organization_dto.py

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from instacrud.model.organization_model import ConversationMessage


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
 