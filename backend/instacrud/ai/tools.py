"""Universal ToolDef descriptor and framework adapters.

Each callable in the system can be paired with a ToolDef that describes its
inputs in JSON Schema format (Anthropic-native).  Adapter functions convert
a ToolDef to the format expected by each LLM framework:

    # Direct Python — just call the function
    result = parse_step_text("S73°28'29\"W 15.27'")

    # Anthropic
    tools = [to_anthropic_tool(PARSE_STEP_TEXT_TOOL)]
    client.messages.create(tools=tools, ...)

    # OpenAI
    tools = [to_openai_tool(PARSE_STEP_TEXT_TOOL)]
    client.chat.completions.create(tools=tools, ...)

    # LangChain / LangGraph
    lc_tool = to_langchain_tool(PARSE_STEP_TEXT_TOOL)
    agent = create_react_agent(llm, [lc_tool])
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict


@dataclass(frozen=True)
class ToolDef:
    """Pairing of a Python callable with its JSON Schema description.

    input_schema follows Anthropic's format (type: "object", properties, required).
    The OpenAI adapter wraps it in the standard function-calling envelope.
    """
    name: str
    description: str
    input_schema: Dict[str, Any]
    fn: Callable


def to_anthropic_tool(td: ToolDef) -> Dict[str, Any]:
    """Return an Anthropic tool dict for use in client.messages.create(tools=[...])."""
    return {
        "name": td.name,
        "description": td.description,
        "input_schema": td.input_schema,
    }


def to_openai_tool(td: ToolDef) -> Dict[str, Any]:
    """Return an OpenAI function-calling dict for use in chat.completions.create(tools=[...])."""
    return {
        "type": "function",
        "function": {
            "name": td.name,
            "description": td.description,
            "parameters": td.input_schema,
        },
    }


def to_langchain_tool(td: ToolDef):
    """Return a LangChain StructuredTool.  Lazy import — safe if langchain_core not installed.

    LangGraph uses LangChain tools directly in tool nodes, so no separate adapter is needed.
    """
    from langchain_core.tools import StructuredTool  # noqa: PLC0415
    return StructuredTool.from_function(
        func=td.fn,
        name=td.name,
        description=td.description,
    )
