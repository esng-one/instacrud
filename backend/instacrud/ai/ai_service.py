from typing import Union, List, Dict, Any, Optional
import json
from beanie import PydanticObjectId
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from instacrud.model.system_model import AiModel, AiServiceProvider
from instacrud.config import settings
from instacrud.ai.mcp_client import McpClient, McpTool
from instacrud.ai.usage_tracker import UsageTracker

from instacrud.ai.ai_service_completion import CompletionMixin
from instacrud.ai.ai_service_embedding import EmbeddingMixin, get_default_embedding_model, calculate_content_embedding
from instacrud.ai.ai_service_vision import VisionMixin, download_image_as_base64


def sanitize_base64_for_logging(value: str) -> str:
    """Sanitize base64 strings for logging by truncating to first 7 characters."""
    if not value:
        return value

    if "base64," in value:
        prefix, base64_part = value.split("base64,", 1)
        if len(base64_part) > 7:
            return f"{prefix}base64,{base64_part[:7]}..."
        return value

    if len(value) > 50 and value.replace("+", "").replace("/", "").replace("=", "").isalnum():
        return f"{value[:7]}..."

    return value


class AiServiceClient(CompletionMixin, EmbeddingMixin, VisionMixin):
    def __init__(
        self,
        ai_model: AiModel,
        mcp_server_url: Optional[str] = None,
        mcp_api_key: Optional[str] = None,
        user_id: Optional[PydanticObjectId] = None,
        track_usage: bool = True
    ):
        self.ai_model = ai_model
        self.model = self._create_model()
        self.mcp_client: Optional[McpClient] = None
        self.mcp_tools: List[McpTool] = []
        self.user_id = user_id
        self.track_usage = track_usage
        self._tier_checked = False

        if mcp_server_url:
            self.mcp_client = McpClient(mcp_server_url, mcp_api_key)

    async def _check_tier_access(self) -> None:
        """Check if the user has tier access to this model."""
        if self._tier_checked or not self.user_id:
            return

        await UsageTracker.check_tier_access(self.user_id, self.ai_model.tier)
        self._tier_checked = True

    @classmethod
    async def from_id(cls, model_id: Union[PydanticObjectId, str]) -> "AiServiceClient":
        if isinstance(model_id, str):
            model_id = PydanticObjectId(model_id)

        ai_model = await AiModel.get(model_id)
        if not ai_model:
            raise ValueError(f"AiModel with _id {model_id} not found")

        return cls(ai_model)

    def _create_model(self):
        kwargs = {"model": self.ai_model.model_identifier}
        if self.ai_model.temperature is not None:
            kwargs["temperature"] = self.ai_model.temperature

        if self.ai_model.max_tokens is not None:
            model_id = self.ai_model.model_identifier.lower()
            if self.ai_model.service == AiServiceProvider.OPEN_AI:
                use_max_completion_tokens = (
                    "claude" in model_id or
                    "gpt-5" in model_id or
                    model_id.startswith("o1") or
                    model_id.startswith("o3")
                )
                if use_max_completion_tokens:
                    kwargs["max_completion_tokens"] = self.ai_model.max_tokens
                else:
                    kwargs["max_tokens"] = self.ai_model.max_tokens
            else:
                kwargs["max_tokens"] = self.ai_model.max_tokens

        if self.ai_model.service == AiServiceProvider.OPEN_AI:
            return ChatOpenAI(**kwargs)
        elif self.ai_model.service == AiServiceProvider.CLAUDE:
            return ChatAnthropic(**kwargs)
        elif self.ai_model.service == AiServiceProvider.DEEP_INFRA:
            api_key = getattr(settings, "DEEP_INFRA_KEY", None)
            kwargs["api_key"] = api_key
            kwargs["base_url"] = "https://api.deepinfra.com/v1/openai"
            return ChatOpenAI(**kwargs)
        elif self.ai_model.service == AiServiceProvider.OLLAMA:
            base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434/v1")
            kwargs["api_key"] = "ollama"
            kwargs["base_url"] = base_url
            return ChatOpenAI(**kwargs)
        else:
            raise ValueError(f"Unsupported AI service: {self.ai_model.service}")

    async def _track_completion_usage(self, response: Any) -> None:
        """Track completion usage based on token counts from the response."""
        if not self.user_id:
            return

        input_tokens = 0
        output_tokens = 0

        if hasattr(response, 'response_metadata'):
            metadata = response.response_metadata
            if 'token_usage' in metadata:
                token_usage = metadata['token_usage']
                input_tokens = token_usage.get('prompt_tokens', 0)
                output_tokens = token_usage.get('completion_tokens', 0)
            elif 'usage' in metadata:
                usage = metadata['usage']
                input_tokens = usage.get('input_tokens', 0)
                output_tokens = usage.get('output_tokens', 0)

        total_tokens = input_tokens + output_tokens
        if total_tokens == 0:
            return

        cost = 0.0
        if self.ai_model.input_tokens_cost and self.ai_model.output_tokens_cost:
            cost = (
                (input_tokens * self.ai_model.input_tokens_cost) +
                (output_tokens * self.ai_model.output_tokens_cost)
            ) / 1_000_000
        else:
            cost = total_tokens * 0.000001

        await UsageTracker.check_and_increment_usage(
            user_id=self.user_id,
            cost=cost
        )

    def _convert_to_anthropic_format(self, content: Any) -> Any:
        """Convert OpenAI-style image content to Anthropic format."""
        if not isinstance(content, list):
            return content

        converted = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "image_url":
                image_url_data = item.get("image_url", {})
                url = image_url_data.get("url", "")

                if url.startswith("data:"):
                    try:
                        header, data = url.split(",", 1)
                        media_type = header.split(":")[1].split(";")[0]
                        converted.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": data
                            }
                        })
                    except (ValueError, IndexError):
                        continue
                else:
                    converted.append({
                        "type": "image",
                        "source": {
                            "type": "url",
                            "url": url
                        }
                    })
            else:
                converted.append(item)

        return converted

    async def initialize_mcp_tools(self):
        """Initialize and load MCP tools from the connected MCP server."""
        if not self.mcp_client:
            raise ValueError("MCP client not configured. Provide mcp_server_url during initialization.")

        self.mcp_tools = await self.mcp_client.list_tools()

    def _convert_mcp_tools_to_langchain_format(self) -> List[Dict[str, Any]]:
        """Convert MCP tools to LangChain tool format for function calling."""
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.input_schema
                }
            }
            for tool in self.mcp_tools
        ]

    async def get_completion_with_mcp_tools(
        self,
        messages: Union[str, List[BaseMessage]],
        auto_execute_tools: bool = True,
        max_iterations: int = 5
    ) -> str:
        """Get completion with MCP tool support."""
        await self._check_tier_access()

        if not self.mcp_client:
            raise ValueError("MCP client not configured")

        if not self.mcp_tools:
            await self.initialize_mcp_tools()

        if isinstance(messages, str):
            messages = [HumanMessage(content=messages)]

        conversation_messages = list(messages)
        tools = self._convert_mcp_tools_to_langchain_format()

        iteration = 0
        while iteration < max_iterations:
            model_with_tools = self.model.bind_tools(tools)
            response = await model_with_tools.ainvoke(conversation_messages)

            if not hasattr(response, 'tool_calls') or not response.tool_calls:
                return response.content

            if not auto_execute_tools:
                return response.content

            conversation_messages.append(AIMessage(content=response.content, tool_calls=response.tool_calls))

            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]

                tool_result = await self.mcp_client.call_tool(tool_name, tool_args)

                conversation_messages.append(
                    ToolMessage(
                        content=json.dumps(tool_result),
                        tool_call_id=tool_call["id"]
                    )
                )

            iteration += 1

        final_response = await self.model.ainvoke(conversation_messages)
        return final_response.content

    async def get_mcp_resources(self) -> List[Dict[str, Any]]:
        """Get available resources from the MCP server."""
        if not self.mcp_client:
            raise ValueError("MCP client not configured")

        resources = await self.mcp_client.list_resources()
        return [
            {
                "uri": resource.uri,
                "name": resource.name,
                "description": resource.description,
                "mime_type": resource.mime_type
            }
            for resource in resources
        ]

    async def read_mcp_resource(self, uri: str) -> Dict[str, Any]:
        """Read a resource from the MCP server."""
        if not self.mcp_client:
            raise ValueError("MCP client not configured")

        return await self.mcp_client.read_resource(uri)

    async def close(self):
        """Close any open connections."""
        if self.mcp_client:
            await self.mcp_client.close()


# Re-export for backwards compatibility
__all__ = [
    'AiServiceClient',
    'sanitize_base64_for_logging',
    'download_image_as_base64',
    'get_default_embedding_model',
    'calculate_content_embedding',
]
