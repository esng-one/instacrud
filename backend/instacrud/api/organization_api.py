# api/organization_api.py

import json
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, Path, Query, HTTPException
from beanie import PydanticObjectId
from loguru import logger

from instacrud.api.api_utils import create_crud_router, role_required
from instacrud.api.organization_dto import ConversationCreate, Entity, Find
from instacrud.api.search_service import SearchService
from instacrud.model.organization_model import Address, Client, Contact, Conversation, Project, ProjectDocument
from instacrud.model.system_model import Role
from instacrud.context import current_user_context

router = APIRouter()
search_service = SearchService()

SEMANTIC_SEARCH_LIMIT = 3

# ------------------------------
# CONVERSATION CRUD (User-scoped, sync-aware)
# ------------------------------

async def _get_effective_local_only(user_id) -> bool:
    """Return True if background sync is disabled for this user."""
    from instacrud.model.system_model import User, Organization
    user = await User.get(user_id)
    if not user:
        return False
    org = None
    if user.organization_id:
        org = await Organization.get(user.organization_id)
    org_local_only = org.local_only_conversations if org else False
    return user.local_only_conversations if user.local_only_conversations is not None else org_local_only


conversation_router = APIRouter()


@conversation_router.get("", response_model=List[Conversation])
async def list_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=500),
    filters: Optional[str] = Query(None),
    _: None = Depends(role_required(Role.ADMIN, Role.ORG_ADMIN, Role.USER)),
):
    user_ctx = current_user_context.get()
    if not user_ctx or not user_ctx.user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    query = {"user_id": user_ctx.user_id}
    if filters:
        try:
            filter_dict = json.loads(filters)
            # Convert UUID string fields to UUID objects for proper BSON matching
            if "external_uuid" in filter_dict and isinstance(filter_dict["external_uuid"], str):
                filter_dict["external_uuid"] = UUID(filter_dict["external_uuid"])
            query = {"$and": [filter_dict, {"user_id": user_ctx.user_id}]}
        except json.JSONDecodeError:
            raise HTTPException(400, "Invalid JSON in filters")
    return await Conversation.find(query).sort("-last_message_at").skip(skip).limit(limit).to_list()


@conversation_router.post("", response_model=Conversation)
async def create_conversation(
    item_data: ConversationCreate = Body(...),
    _: None = Depends(role_required(Role.ADMIN, Role.ORG_ADMIN, Role.USER)),
):
    user_ctx = current_user_context.get()
    if not user_ctx or not user_ctx.user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    if await _get_effective_local_only(user_ctx.user_id):
        raise HTTPException(status_code=400, detail="Conversation sync is disabled for this organization.")

    # Upsert by external_uuid to prevent duplicates from concurrent syncs (e.g. multiple tabs)
    if item_data.external_uuid:
        ext_uuid = UUID(item_data.external_uuid)
        existing = await Conversation.find_one({"external_uuid": ext_uuid, "user_id": user_ctx.user_id})
        if existing:
            if item_data.title is not None:
                existing.title = item_data.title
            if item_data.messages is not None:
                existing.messages = item_data.messages
            if item_data.model_id is not None:
                existing.model_id = PydanticObjectId(item_data.model_id)
            if item_data.last_message_at is not None:
                existing.last_message_at = item_data.last_message_at
            await existing.save()
            return existing

    conversation = Conversation(
        user_id=user_ctx.user_id,
        external_uuid=UUID(item_data.external_uuid) if item_data.external_uuid else uuid4(),
        title=item_data.title,
        messages=item_data.messages,
        model_id=PydanticObjectId(item_data.model_id) if item_data.model_id else None,
        last_message_at=item_data.last_message_at or datetime.now(tz=timezone.utc),
    )
    await conversation.insert()
    return conversation


@conversation_router.get("/{item_id}", response_model=Conversation)
async def get_conversation(
    item_id: str = Path(...),
    _: None = Depends(role_required(Role.ADMIN, Role.ORG_ADMIN, Role.USER)),
):
    user_ctx = current_user_context.get()
    if not user_ctx or not user_ctx.user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    conversation = await Conversation.get(item_id)
    if not conversation or conversation.user_id != user_ctx.user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@conversation_router.put("/{item_id}", response_model=Conversation)
async def update_conversation(
    item_id: str,
    item_data: Conversation = Body(...),
    _: None = Depends(role_required(Role.ADMIN, Role.ORG_ADMIN, Role.USER)),
):
    user_ctx = current_user_context.get()
    if not user_ctx or not user_ctx.user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    if await _get_effective_local_only(user_ctx.user_id):
        raise HTTPException(status_code=400, detail="Conversation sync is disabled for this organization.")
    conversation = await Conversation.get(item_id)
    if not conversation or conversation.user_id != user_ctx.user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    data = item_data.model_dump(exclude_unset=True)
    immutable = {"id", "_id", "created_at", "created_by", "user_id"}
    for field, value in data.items():
        if field not in immutable:
            setattr(conversation, field, value)
    await conversation.save()
    return conversation


@conversation_router.patch("/{item_id}", response_model=Conversation)
async def patch_conversation(
    item_id: str,
    item_data: dict = Body(...),
    _: None = Depends(role_required(Role.ADMIN, Role.ORG_ADMIN, Role.USER)),
):
    user_ctx = current_user_context.get()
    if not user_ctx or not user_ctx.user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    if await _get_effective_local_only(user_ctx.user_id):
        raise HTTPException(status_code=400, detail="Conversation sync is disabled for this organization.")
    conversation = await Conversation.get(item_id)
    if not conversation or conversation.user_id != user_ctx.user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    immutable = {"id", "_id", "created_at", "created_by", "user_id"}
    for field, value in item_data.items():
        if field not in immutable and hasattr(conversation, field):
            if field == "last_message_at" and isinstance(value, str):
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            setattr(conversation, field, value)
    await conversation.save()
    return conversation


@conversation_router.delete("/{item_id}", status_code=204)
async def delete_conversation(
    item_id: str = Path(...),
    _: None = Depends(role_required(Role.ADMIN, Role.ORG_ADMIN, Role.USER)),
):
    user_ctx = current_user_context.get()
    if not user_ctx or not user_ctx.user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    conversation = await Conversation.get(item_id)
    if not conversation:
        return None
    if conversation.user_id != user_ctx.user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await conversation.delete()
    return None


router.include_router(conversation_router, prefix="/conversations", tags=["conversations"])

# Standard CRUD routers
router.include_router(create_crud_router(Client), prefix="/clients", tags=["clients"])
router.include_router(create_crud_router(Project), prefix="/projects", tags=["projects"])
router.include_router(create_crud_router(ProjectDocument), prefix="/documents", tags=["documents"])
router.include_router(create_crud_router(Contact), prefix="/contacts", tags=["contacts"])
router.include_router(create_crud_router(Address), prefix="/addresses", tags=["addresses"])

# Example of an extra endpoint (beyond standard CRUD)
@router.get("/projects/period", response_model=List[Project])
async def get_projects_period(
    start: datetime = Query(...),
    end: datetime = Query(...),
    skip: int = 0,
    limit: int = 10,
):
    return (
        await Project.find({"start_date": {"$gte": start, "$lte": end}})
        .sort("-start_date")
        .skip(skip)
        .limit(limit)
        .to_list()
    )


# Models to search in and which fields to check
SEARCH_MODELS = [
    {"model": Project, "api": "projects", "fields": ["name", "code"]},
    {"model": ProjectDocument, "api": "documents", "fields": ["name", "code"]},
    {"model": Client, "api": "clients", "fields": ["name", "code"]},
    {"model": Contact, "api": "contacts", "fields": ["name"]},
]

# Semantic search configuration - maps model to embedding field
SEMANTIC_SEARCH_MODELS = [
    {"model": ProjectDocument, "api": "documents", "embedding_field": "content_embedding", "index": "document_content_vector_index"},
]

@router.get("/find", response_model=Find, tags=["search"])
async def find_entities(q: str = Query(..., min_length=3)):
    hits = await search_service.search(
        query=q,
        model_entries=SEARCH_MODELS,
        limit=20,
    )

    entities: list[Entity] = []

    for api, doc in hits:
        entities.append(
            Entity(
                api=api,
                id=str(doc.id),
                name=getattr(doc, "name", getattr(doc, "code", "")),
            )
        )
        if len(entities) >= 20:
            break

    return Find(entities=entities)


@router.get("/find-semantic", response_model=Find, tags=["search"])
async def find_entities_semantic(q: str = Query(..., min_length=3)):
    """
    Semantic search using vector embeddings.

    Searches through documents with embeddings using vector similarity.
    Returns results ranked by semantic relevance to the query.

    Note: Uses MongoDB Atlas $vectorSearch when available, falls back to
    in-memory FAISS for local development.
    """
    from instacrud.ai.ai_service import calculate_content_embedding
    from instacrud.context import current_user_context
    from instacrud.config import settings
    
    # Get current user for usage tracking
    user_ctx = current_user_context.get()
    user_id = user_ctx.user_id if user_ctx else None

    # Generate query embedding (with usage tracking)
    query_embedding = await calculate_content_embedding(
        content=q,
        user_id=user_id,
        track_usage=True
    )

    if not query_embedding:
        raise HTTPException(
            status_code=503,
            detail="Semantic search unavailable (no embedding model configured)"
        )

    entities: list[Entity] = []

    # Search through each configured model
    for config in SEMANTIC_SEARCH_MODELS:
        model = config["model"]
        api = config["api"]
        embedding_field = config["embedding_field"]
        index_name = config["index"]

        # Use MongoDB Atlas $vectorSearch only if DB_ENGINE is "atlas"
        atlas_success = False
        if settings.DB_ENGINE == "atlas":
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": index_name,
                        "path": embedding_field,
                        "queryVector": query_embedding,
                        "numCandidates": 100,
                        "limit": SEMANTIC_SEARCH_LIMIT
                    }
                },
                {
                    "$project": {
                        "_id": 1,
                        "name": 1,
                        "code": 1,
                        "score": {"$meta": "vectorSearchScore"}
                    }
                }
            ]

            try:
                # Use the underlying PyMongo collection for raw aggregation
                collection = model.get_pymongo_collection()
                cursor = collection.aggregate(pipeline)
                results = await cursor.to_list(length=20)

                for doc in results:
                    entities.append(
                        Entity(
                            api=api,
                            id=str(doc["_id"]),
                            name=doc.get("name", doc.get("code", ""))
                        )
                    )

                    if len(entities) >= 20:
                        break

                atlas_success = True
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Atlas vector search failed for {api}: {error_msg}")

        # FAISS fallback for non-Atlas engines (mongo, firestore)
        if not atlas_success:
            try:
                entities.extend(await _faiss_semantic_search(
                    model=model,
                    api=api,
                    embedding_field=embedding_field,
                    query_embedding=query_embedding,
                    limit=SEMANTIC_SEARCH_LIMIT
                ))
            except ImportError:
                logger.warning("FAISS not installed - install faiss-cpu for local vector search")
            except Exception as e:
                logger.error(f"FAISS fallback failed for {api}: {str(e)}")

        if len(entities) >= 20:
            break

    return Find(entities=entities)


async def _faiss_semantic_search(
    model,
    api: str,
    embedding_field: str,
    query_embedding: List[float],
    limit: int = SEMANTIC_SEARCH_LIMIT
) -> List[Entity]:
    """
    DEMO: Perform semantic search using in-memory FAISS index.

    This is a fallback for local development when MongoDB Atlas vector search
    is not available. The index is built on first use and persists in memory
    until server restart.

    WARNING: For production, replace with a persistent vector search solution
    such as Milvus, Pinecone, Weaviate, or MongoDB Atlas Vector Search.
    """
    from instacrud.ai.vector_search import get_vector_search, needs_vector_refresh, mark_vector_refreshed

    vector_search = get_vector_search()

    # Initialize index on first use, or refresh if invalidated
    if not vector_search.is_initialized or needs_vector_refresh():
        reason = "stale" if vector_search.is_initialized else "first use"
        logger.info(f"Loading FAISS index for {api} ({reason})...")
        vector_search.clear()
        count = await vector_search.initialize_from_database(
            model_class=model,
            embedding_field=embedding_field,
            api=api
        )
        mark_vector_refreshed()
        logger.info(f"FAISS index ready with {count} documents")

    # Search
    results = vector_search.search(query_embedding, limit=limit)

    return [
        Entity(
            api=doc.api,
            id=doc.id,
            name=doc.name
        )
        for doc, score in results
    ]


# Endpoint to recalculate embeddings for a document
@router.post("/documents/{document_id}/recalculate-embedding", tags=["documents"])
async def recalculate_document_embedding(document_id: str):
    """
    Force recalculate the content embedding for a specific document.

    This endpoint:
    - Retrieves the document by ID
    - Recalculates the embedding from the content field
    - Saves the updated embedding to the database
    """
    try:
        doc_obj_id = PydanticObjectId(document_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    document = await ProjectDocument.get(doc_obj_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.content:
        raise HTTPException(status_code=400, detail="Document has no content to embed")

    await document.recalculate_embedding()

    return {
        "message": "Embedding recalculated successfully",
        "document_id": document_id,
        "embedding_dimensions": len(document.content_embedding) if document.content_embedding else 0
    }


# Endpoint to recalculate embeddings for all documents
@router.post("/documents/recalculate-embeddings-all", tags=["documents"])
async def recalculate_all_document_embeddings():
    """
    Force recalculate embeddings for all documents that have content.

    This is useful for:
    - Initial setup of embeddings on existing documents
    - Switching to a new embedding model
    - Fixing documents with missing embeddings

    Returns statistics about the operation.
    """
    documents = await ProjectDocument.find(ProjectDocument.content != None).to_list()

    total = len(documents)
    success = 0
    failed = 0
    skipped = 0

    for document in documents:
        try:
            if not document.content:
                skipped += 1
                continue

            await document.recalculate_embedding()
            success += 1
        except Exception as e:
            logger.error(f"Failed to recalculate embedding for document {document.code}: {str(e)}")
            failed += 1

    return {
        "message": "Batch embedding recalculation completed",
        "total_documents": total,
        "successful": success,
        "failed": failed,
        "skipped": skipped
    }
