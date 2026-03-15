import re
from beanie import Document
from loguru import logger
from typing import Iterable, Dict, Any

from instacrud.config import settings
from instacrud.api.search import build_search_tokens


class SearchService:
    async def search(
        self,
        *,
        query: str,
        model_entries: Iterable[Dict[str, Any]],
        limit: int = 20,
        # organization_id: str | None = None,
        allow_fallback: bool | None = None,
    ) -> list[tuple[str, Document]]:
        """
        Returns list of (api, document) tuples.
        """
        q = query.strip().lower()
        if not q:
            return []

        fallback_enabled = (
            settings.SEARCH_FALLBACK_ENABLED
            if allow_fallback is None
            else allow_fallback
        )

        hits: list[tuple[str, Document]] = []
        query_tokens = build_search_tokens(query)

        for entry in model_entries:
            remaining = limit - len(hits)
            if remaining <= 0:
                break

            model: type[Document] = entry["model"]
            api: str = entry["api"]
            fields: list[str] = entry.get("fields", [])

            # ---------------------------------
            # 1. Fast path: token-based search
            # ---------------------------------
            token_filter: dict[str, Any] = {"search_tokens": {"$all": query_tokens}}

            docs = await model.find(token_filter).limit(remaining).to_list()
            if docs:
                for d in docs:
                    hits.append((api, d))
                    remaining -= 1
                    if remaining <= 0:
                        break
                continue

            if remaining <= 0:
                break

            # ---------------------------------
            # 2. Slow path: fallback regex
            # ---------------------------------
            if (
                not fallback_enabled
                or len(q) < settings.SEARCH_FALLBACK_MIN_QUERY_LEN
                or not fields
            ):
                continue

            or_query = {
                "$or": [
                    {field: {"$regex": re.escape(q), "$options": "i"}}
                    for field in fields
                ]
            }

            fallback_take = min(settings.SEARCH_FALLBACK_LIMIT, remaining)
            fb_docs = await model.find(or_query).limit(fallback_take).to_list()

            if fb_docs:
                logger.warning(f"Search fallback used: model={model.__name__} api={api} query={q} count={len(fb_docs)}")

            for d in fb_docs:
                hits.append((api, d))
                remaining -= 1
                if remaining <= 0:
                    break

        return hits
