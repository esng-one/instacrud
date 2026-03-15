# context.py

from contextvars import ContextVar
from typing import Optional
from beanie import PydanticObjectId
from pydantic import BaseModel

class CurrentUserContext(BaseModel):
    user_id: Optional[PydanticObjectId] = None
    email: Optional[str] = None
    role: Optional[str] = None
    organization_id: Optional[str] = None

current_user_context: ContextVar[CurrentUserContext] = ContextVar("current_user_context", default=CurrentUserContext())