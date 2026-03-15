# instacrud/ai/vector_search.py
"""
DEMO: In-memory vector search using FAISS with cosine similarity.

This is a demonstration implementation for local development without MongoDB Atlas.
The index is built on first search and persists in memory until server restart.

WARNING: This is NOT suitable for production use!
- Index is lost on server restart
- All vectors must fit in memory
- No persistence or replication

For production, replace with a persistent vector search database such as:
- Milvus (https://milvus.io/)
- Pinecone (https://pinecone.io/)
- Weaviate (https://weaviate.io/)
- MongoDB Atlas Vector Search
"""

from typing import List, Optional, Tuple, Any, Dict
from dataclasses import dataclass
import numpy as np
from loguru import logger

# FAISS import - lazy loaded to handle missing dependency gracefully
_faiss = None


def _get_faiss():
    """Lazy load FAISS to handle missing dependency."""
    global _faiss
    if _faiss is None:
        try:
            import faiss
            _faiss = faiss
        except ImportError:
            raise ImportError(
                "faiss-cpu is required for demo vector search. "
                "Install it with: pip install faiss-cpu"
            )
    return _faiss


@dataclass
class IndexedDocument:
    """Represents a document in the FAISS index."""
    id: str
    name: str
    api: str


class FaissVectorSearch:
    """
    DEMO: In-memory vector search using FAISS.

    This class provides a simple vector similarity search implementation
    using FAISS with cosine similarity (via inner product on normalized vectors).

    The index is initialized lazily on first search and remains in memory
    until the server is restarted.
    """

    def __init__(self):
        self._index: Optional[Any] = None  # faiss.IndexFlatIP
        self._documents: List[IndexedDocument] = []
        self._dimension: Optional[int] = None
        self._initialized: bool = False

    @property
    def is_initialized(self) -> bool:
        """Check if the index has been initialized."""
        return self._initialized

    @property
    def document_count(self) -> int:
        """Get the number of documents in the index."""
        return len(self._documents)

    async def initialize_from_database(self, model_class: Any, embedding_field: str, api: str) -> int:
        """
        Initialize the FAISS index from database documents.

        Args:
            model_class: The Beanie document model class
            embedding_field: Name of the field containing embeddings
            api: API identifier for the documents

        Returns:
            Number of documents indexed
        """
        faiss = _get_faiss()

        # Fetch all documents with embeddings
        query = {embedding_field: {"$ne": None}}
        documents = await model_class.find(query).to_list()

        if not documents:
            logger.warning(f"No documents with embeddings found for {api}")
            return 0

        # Extract embeddings and document info
        embeddings = []
        self._documents = []

        for doc in documents:
            embedding = getattr(doc, embedding_field, None)
            if embedding and len(embedding) > 0:
                embeddings.append(embedding)
                self._documents.append(IndexedDocument(
                    id=str(doc.id),
                    name=getattr(doc, "name", getattr(doc, "code", "")),
                    api=api
                ))

        if not embeddings:
            logger.warning(f"No valid embeddings found for {api}")
            return 0

        # Convert to numpy array and normalize for cosine similarity
        embeddings_array = np.array(embeddings, dtype=np.float32)
        self._dimension = embeddings_array.shape[1]

        # Normalize vectors for cosine similarity (inner product of normalized vectors = cosine similarity)
        faiss.normalize_L2(embeddings_array)

        # Create FAISS index using inner product (cosine similarity with normalized vectors)
        self._index = faiss.IndexFlatIP(self._dimension)
        self._index.add(embeddings_array)

        self._initialized = True
        logger.info(f"FAISS index initialized with {len(self._documents)} documents (dim={self._dimension})")

        return len(self._documents)

    def search(
        self,
        query_embedding: List[float],
        limit: int = 20
    ) -> List[Tuple[IndexedDocument, float]]:
        """
        Search for similar documents.

        Args:
            query_embedding: The query vector
            limit: Maximum number of results to return

        Returns:
            List of (document, score) tuples, sorted by similarity (highest first)
        """
        if not self._initialized or self._index is None:
            return []

        faiss = _get_faiss()

        # Convert query to numpy array and normalize
        query_array = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(query_array)

        # Search
        k = min(limit, len(self._documents))
        if k == 0:
            return []

        scores, indices = self._index.search(query_array, k)

        # Build results
        results = []
        for i, idx in enumerate(indices[0]):
            if idx >= 0 and idx < len(self._documents):
                results.append((self._documents[idx], float(scores[0][i])))

        return results

    def clear(self):
        """Clear the index and reset state."""
        self._index = None
        self._documents = []
        self._dimension = None
        self._initialized = False
        logger.info("FAISS index cleared")


# Per-tenant instances - keyed by database ID
_vector_search_instances: Dict[str, FaissVectorSearch] = {}
# Per-tenant invalidation flags - True means index needs refresh
_needs_refresh: Dict[str, bool] = {}


def get_vector_search() -> FaissVectorSearch:
    """
    Get the FaissVectorSearch instance for the current tenant.

    Creates a new instance if one doesn't exist for this tenant.
    Each tenant gets an isolated FAISS index.
    """
    from instacrud.database import get_current_db_id

    db_id = get_current_db_id() or "_default"

    if db_id not in _vector_search_instances:
        _vector_search_instances[db_id] = FaissVectorSearch()
        logger.debug(f"Created FAISS index for tenant: {db_id}")

    return _vector_search_instances[db_id]


def clear_vector_search(db_id: Optional[str] = None) -> None:
    """
    Clear FAISS index for a specific tenant or all tenants.

    Args:
        db_id: Tenant database ID to clear, or None to clear all
    """
    if db_id:
        if db_id in _vector_search_instances:
            _vector_search_instances[db_id].clear()
            del _vector_search_instances[db_id]
        _needs_refresh.pop(db_id, None)
    else:
        for instance in _vector_search_instances.values():
            instance.clear()
        _vector_search_instances.clear()
        _needs_refresh.clear()


def invalidate_vector_search() -> None:
    """
    Mark the current tenant's FAISS index as needing refresh.
    Call this when a new embedding is generated.
    """
    from instacrud.database import get_current_db_id

    db_id = get_current_db_id() or "_default"
    _needs_refresh[db_id] = True
    logger.debug(f"FAISS index invalidated for tenant: {db_id}")


def needs_vector_refresh() -> bool:
    """
    Check if current tenant's FAISS index needs refresh.
    Returns True if index exists but is stale, False otherwise.
    """
    from instacrud.database import get_current_db_id

    db_id = get_current_db_id() or "_default"

    # No index yet - will be loaded fresh anyway
    if db_id not in _vector_search_instances:
        return False

    return _needs_refresh.get(db_id, False)


def mark_vector_refreshed() -> None:
    """Mark current tenant's FAISS index as up-to-date."""
    from instacrud.database import get_current_db_id

    db_id = get_current_db_id() or "_default"
    _needs_refresh[db_id] = False
