# model/organization_model.py

from beanie import Indexed, PydanticObjectId, Save, before_event
from beanie.odm.actions import EventTypes
from pydantic import BaseModel, EmailStr, Field, field_serializer
from typing import Annotated, Optional, List
from enum import Enum
from datetime import datetime, timezone
from uuid import UUID, uuid4

from instacrud.model.system_model import RootModel
from instacrud.api.search import SearchableMixin, build_search_tokens
from instacrud.api.validators import DateValidatorMixin, UtcDatetimeMixin

# ----------------------------------------------------------
# System-Level Models Stored in the Organizational Databases
# ----------------------------------------------------------

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class ConversationMessage(BaseModel, UtcDatetimeMixin):
    role: MessageRole
    content: str
    image_data: Optional[str] = None
    image_url: Optional[str] = None
    generated_images: Optional[List[str]] = None
    reasoning_content: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

class Conversation(RootModel):
    user_id: Annotated[PydanticObjectId, Indexed()]
    external_uuid: Annotated[UUID, Indexed()] = Field(default_factory=uuid4)
    title: Optional[str] = None
    messages: List[ConversationMessage] = Field(default_factory=list)
    model_id: Optional[PydanticObjectId] = None
    last_message_at: datetime = Field(default_factory=lambda: datetime.now(tz=timezone.utc))

    class Settings:
        name = "conversations"

    @field_serializer('last_message_at')
    def serialize_last_message_at(self, v: datetime) -> str:
        return v.replace(tzinfo=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f') + 'Z'

    @before_event(Save)
    async def update_last_message_time(self):
        if self.messages:
            self.last_message_at = datetime.now(tz=timezone.utc)
            # Auto-generate title from first user message if not set
            if not self.title and len(self.messages) > 0:
                first_user_msg = next((msg for msg in self.messages if msg.role == MessageRole.USER), None)
                if first_user_msg:
                    # Use first 50 chars of first user message as title
                    self.title = first_user_msg.content[:50] + ("..." if len(first_user_msg.content) > 50 else "")

# ----------------------------
# Organizational-Level Models
# ----------------------------

class Contact(RootModel, SearchableMixin):
    name: Annotated[str, Indexed()]
    title: Optional[str] = None
    email: Annotated[Optional[EmailStr], Indexed(unique=True)] = None
    phone: Annotated[Optional[str], Indexed(unique=True)] = None

    @before_event(EventTypes.INSERT)
    @before_event(EventTypes.REPLACE)
    def update_search_tokens(self):
        self.search_tokens = build_search_tokens(
            self.name,
        )

    class Settings:
        name = "contacts"

class Address(RootModel):
    street: str
    street2: Optional[str] = None
    city: Annotated[str, Indexed()]
    state: str
    zip_code: Annotated[str, Indexed()]
    country: str = "USA"

    class Settings:
        name = "addresses"

class ClientType(str, Enum):
    COMPANY = "COMPANY"
    PERSON = "PERSON"

class Client(RootModel, SearchableMixin):
    code: Annotated[str, Indexed(unique=True)]
    name: Annotated[str, Indexed()]
    type: Annotated[ClientType, Indexed()]
    contact_ids: Optional[List[PydanticObjectId]] = None
    address_ids: Optional[List[PydanticObjectId]] = None
    description: Optional[str] = None

    @before_event(EventTypes.INSERT)
    @before_event(EventTypes.REPLACE)
    def update_search_tokens(self):
        self.search_tokens = build_search_tokens(
            self.code,
            self.name,
        )

    class Settings:
        name = "clients"

class Project(RootModel, DateValidatorMixin, SearchableMixin):
    code: Annotated[str, Indexed(unique=True)]
    client_id: Annotated[Optional[PydanticObjectId], Indexed()]
    name: Annotated[str, Indexed()]
    start_date: Annotated[datetime, Indexed()]
    end_date: Annotated[Optional[datetime], Indexed()] = None
    description: Optional[str] = None

    @before_event(EventTypes.INSERT)
    @before_event(EventTypes.REPLACE)
    def update_search_tokens(self):
        self.search_tokens = build_search_tokens(
            self.code,
            self.name,
        )

    class Settings:
        name = "projects"

class ProjectDocument(RootModel, SearchableMixin):
    project_id: Annotated[PydanticObjectId, Indexed()]
    code: Annotated[str, Indexed(unique=True)]
    name: Annotated[str, Indexed()]
    content: Optional[str] = None
    description: Optional[str] = None
    content_embedding: Optional[List[float]] = None

    @before_event(EventTypes.INSERT)
    @before_event(EventTypes.REPLACE)
    def update_search_tokens(self):
        self.search_tokens = build_search_tokens(
            self.code,
            self.name,
        )

    @before_event(EventTypes.INSERT)
    @before_event(EventTypes.REPLACE)
    async def update_content_embedding(self):
        """Calculate embeddings for content field if it exists."""
        from instacrud.ai.ai_service import calculate_content_embedding
        from instacrud.ai.vector_search import invalidate_vector_search
        from instacrud.context import current_user_context

        if self.content:
            # Get current user for usage tracking
            user_ctx = current_user_context.get()
            user_id = user_ctx.user_id if user_ctx else None

            # Calculate embedding with usage tracking
            embedding = await calculate_content_embedding(
                content=self.content,
                user_id=user_id,
                track_usage=True
            )

            if embedding:
                self.content_embedding = embedding
                # DEMO: Invalidate in-memory FAISS index (see vector_search.py)
                invalidate_vector_search()

    async def recalculate_embedding(self):
        """Force recalculate embedding for this document."""
        from instacrud.ai.ai_service import calculate_content_embedding
        from instacrud.ai.vector_search import invalidate_vector_search
        from instacrud.context import current_user_context

        if self.content:
            # Get current user for usage tracking
            user_ctx = current_user_context.get()
            user_id = user_ctx.user_id if user_ctx else None

            # Calculate embedding with usage tracking
            embedding = await calculate_content_embedding(
                content=self.content,
                user_id=user_id,
                track_usage=True
            )

            if embedding:
                self.content_embedding = embedding
                # DEMO: Invalidate in-memory FAISS index (see vector_search.py)
                invalidate_vector_search()
                await self.save()

    class Settings:
        name = "documents"
