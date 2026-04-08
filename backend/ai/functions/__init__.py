"""ai.functions — CRUD and Conversations tool functions for LLM tool-calling.

Usage::

    from ai.functions.crud import (
        crud_list, CRUD_LIST_TOOL,
        crud_get, CRUD_GET_TOOL,
        crud_create, CRUD_CREATE_TOOL,
        crud_update, CRUD_UPDATE_TOOL,
        crud_patch, CRUD_PATCH_TOOL,
        crud_delete, CRUD_DELETE_TOOL,
        conversations_list, CONVERSATIONS_LIST_TOOL,
        conversations_get, CONVERSATIONS_GET_TOOL,
        conversations_create, CONVERSATIONS_CREATE_TOOL,
        conversations_patch, CONVERSATIONS_PATCH_TOOL,
        conversations_delete, CONVERSATIONS_DELETE_TOOL,
        find_entities, FIND_ENTITIES_TOOL,
        ALL_TOOLS,
        to_anthropic_tool, to_openai_tool, to_langchain_tool,
    )

    # Direct Python (async)
    items = await crud_list("Client", limit=5)

    # Anthropic
    tools = [to_anthropic_tool(CRUD_LIST_TOOL)]

    # OpenAI
    tools = [to_openai_tool(CRUD_LIST_TOOL)]

    # LangChain / LangGraph
    lc_tool = to_langchain_tool(CRUD_LIST_TOOL)
"""

from instacrud.ai.tools import to_anthropic_tool, to_openai_tool, to_langchain_tool  # noqa: F401

from .crud import (
    crud_list, CRUD_LIST_TOOL,
    crud_get, CRUD_GET_TOOL,
    crud_create, CRUD_CREATE_TOOL,
    crud_update, CRUD_UPDATE_TOOL,
    crud_patch, CRUD_PATCH_TOOL,
    crud_delete, CRUD_DELETE_TOOL,
    conversations_list, CONVERSATIONS_LIST_TOOL,
    conversations_get, CONVERSATIONS_GET_TOOL,
    conversations_create, CONVERSATIONS_CREATE_TOOL,
    conversations_patch, CONVERSATIONS_PATCH_TOOL,
    conversations_delete, CONVERSATIONS_DELETE_TOOL,
    find_entities, FIND_ENTITIES_TOOL,
    ALL_TOOLS,
)

__all__ = [
    # Adapters
    "to_anthropic_tool",
    "to_openai_tool",
    "to_langchain_tool",
    "ALL_TOOLS",
    # Generic CRUD
    "crud_list", "CRUD_LIST_TOOL",
    "crud_get", "CRUD_GET_TOOL",
    "crud_create", "CRUD_CREATE_TOOL",
    "crud_update", "CRUD_UPDATE_TOOL",
    "crud_patch", "CRUD_PATCH_TOOL",
    "crud_delete", "CRUD_DELETE_TOOL",
    # Conversations
    "conversations_list", "CONVERSATIONS_LIST_TOOL",
    "conversations_get", "CONVERSATIONS_GET_TOOL",
    "conversations_create", "CONVERSATIONS_CREATE_TOOL",
    "conversations_patch", "CONVERSATIONS_PATCH_TOOL",
    "conversations_delete", "CONVERSATIONS_DELETE_TOOL",
    # Cross-model search
    "find_entities", "FIND_ENTITIES_TOOL",
]
