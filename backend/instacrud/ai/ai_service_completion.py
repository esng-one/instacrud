from typing import Union, List, AsyncIterator, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from instacrud.model.system_model import AiModel, AiServiceProvider
from instacrud.config import settings
from openai import AsyncOpenAI


class CompletionMixin:
    """Mixin providing completion-related methods for AiServiceClient."""

    ai_model: AiModel
    model: Any
    user_id: Any
    track_usage: bool

    async def _check_tier_access(self) -> None:
        """To be implemented by the main class."""
        raise NotImplementedError

    async def _track_completion_usage(self, response: Any) -> None:
        """To be implemented by the main class."""
        raise NotImplementedError

    def _convert_to_anthropic_format(self, content: Any) -> Any:
        """To be implemented by the main class."""
        raise NotImplementedError

    async def get_completion(self, messages: Union[str, List[BaseMessage]]) -> str:
        await self._check_tier_access()

        if isinstance(messages, str):
            messages = [HumanMessage(content=messages)]

        response = await self.model.ainvoke(messages)

        if self.track_usage and self.user_id:
            await self._track_completion_usage(response)

        return response.content

    async def get_completion_streaming(
        self, messages: Union[str, List[BaseMessage]], reasoning: bool = False
    ) -> AsyncIterator[str]:
        await self._check_tier_access()

        if isinstance(messages, str):
            messages = [HumanMessage(content=messages)]

        if reasoning and self.ai_model.reasoning:
            async for chunk in self._stream_with_reasoning(messages):
                yield chunk
            return

        async for chunk in self.model.astream(messages):
            if hasattr(chunk, 'content') and chunk.content:
                yield chunk.content

    async def _stream_with_reasoning(self, messages: List[BaseMessage]) -> AsyncIterator[str]:
        """Stream completion with reasoning/chain-of-thought support."""
        if self.ai_model.service == AiServiceProvider.CLAUDE:
            async for chunk in self._stream_with_claude_thinking(messages):
                yield chunk

        elif self.ai_model.service in [
            AiServiceProvider.OPEN_AI,
            AiServiceProvider.DEEP_INFRA,
            AiServiceProvider.OLLAMA
        ]:
            client, max_tokens_key = self._get_openai_client_for_reasoning()
            openai_messages = self._convert_messages_to_openai_format(messages)

            stream_kwargs = {
                "model": self.ai_model.model_identifier,
                "stream": True,
                max_tokens_key: self.ai_model.max_tokens or 16000,
            }

            async for chunk in self._stream_and_parse_thinking_tags(openai_messages, stream_kwargs, client):
                yield chunk
        else:
            async for chunk in self.model.astream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    yield chunk.content

    def _get_openai_client_for_reasoning(self) -> tuple[AsyncOpenAI, str]:
        """Get the appropriate OpenAI client and max_tokens key for reasoning."""
        if self.ai_model.service == AiServiceProvider.OPEN_AI:
            client = AsyncOpenAI()
            model_id = self.ai_model.model_identifier.lower()
            is_modern_model = (
                "claude" in model_id or
                "gpt-5" in model_id or
                model_id.startswith("o1") or
                model_id.startswith("o3")
            )
            max_tokens_key = "max_completion_tokens" if is_modern_model else "max_tokens"

        elif self.ai_model.service == AiServiceProvider.DEEP_INFRA:
            api_key = getattr(settings, "DEEP_INFRA_KEY", None)
            client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepinfra.com/v1/openai")
            max_tokens_key = "max_tokens"

        elif self.ai_model.service == AiServiceProvider.OLLAMA:
            base_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434/v1")
            client = AsyncOpenAI(api_key="ollama", base_url=base_url)
            max_tokens_key = "max_tokens"
        else:
            raise ValueError(f"Unsupported service for reasoning: {self.ai_model.service}")

        return client, max_tokens_key

    def _convert_messages_to_openai_format(self, messages: List[BaseMessage]) -> List[Dict[str, Any]]:
        """Convert LangChain messages to OpenAI format."""
        openai_messages = []
        for msg in messages:
            role = "user"
            if isinstance(msg, AIMessage):
                role = "assistant"
            elif isinstance(msg, SystemMessage):
                role = "system"
            openai_messages.append({"role": role, "content": msg.content})
        return openai_messages

    async def _stream_with_claude_thinking(self, messages: List[BaseMessage]) -> AsyncIterator[str]:
        """Handles streaming with native Claude thinking feature."""
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic()

        anthropic_messages = []
        system_content = None
        for msg in messages:
            if isinstance(msg, HumanMessage):
                content = self._convert_to_anthropic_format(msg.content)
                anthropic_messages.append({"role": "user", "content": content})
            elif isinstance(msg, AIMessage):
                anthropic_messages.append({"role": "assistant", "content": msg.content})
            elif isinstance(msg, SystemMessage):
                system_content = msg.content

        # Claude Opus 4.5 max_tokens limit is 64000
        # budget_tokens must be < max_tokens
        # Higher thinking budget enables deeper multi-step reasoning
        # 10k is minimal (single step), 32k+ enables iterative thinking
        MODEL_MAX_TOKENS = 64000
        thinking_budget = min(
            32000,  # good balance for iterative thinking
            max(10000, (self.ai_model.max_tokens or 16000))
        )
        # Ensure max_tokens > budget_tokens but doesn't exceed model limit
        max_tokens = min(MODEL_MAX_TOKENS, thinking_budget + 16000)

        stream_kwargs = {
            "model": self.ai_model.model_identifier,
            "max_tokens": max_tokens,
            "messages": anthropic_messages,
            "thinking": {
                "type": "enabled",
                "budget_tokens": thinking_budget
            }
        }
        if system_content:
            stream_kwargs["system"] = system_content

        async with client.messages.stream(**stream_kwargs) as stream:
            in_thinking = False
            async for event in stream:
                if event.type == 'content_block_start' and event.content_block.type == 'thinking':
                    in_thinking = True
                    yield "[REASONING]"
                elif event.type == 'content_block_start' and event.content_block.type == 'text':
                    if in_thinking:
                        yield "[/REASONING]"
                        in_thinking = False
                elif event.type == 'content_block_delta' and hasattr(event.delta, 'thinking'):
                    yield event.delta.thinking
                elif event.type == 'content_block_delta' and hasattr(event.delta, 'text'):
                    yield event.delta.text
                elif event.type == 'content_block_stop' and in_thinking:
                    yield "[/REASONING]"
                    in_thinking = False

    async def _stream_and_parse_thinking_tags(
        self,
        messages: List[Dict[str, Any]],
        stream_kwargs: Dict[str, Any],
        client: AsyncOpenAI
    ) -> AsyncIterator[str]:
        """Injects a thinking prompt, streams the response, and parses <think> tags."""
        is_text_only = all(isinstance(msg.get("content"), str) for msg in messages)

        if is_text_only:
            thinking_prompt = (
                "When responding, first think step-by-step inside <think></think> tags. "
                "Analyze the user's request, outline your plan, and then generate the final response outside the tags."
            )
            has_system_message = any(msg.get("role") == "system" for msg in messages)
            if has_system_message:
                for msg in messages:
                    if msg.get("role") == "system":
                        msg["content"] = thinking_prompt + "\n\n" + msg.get("content", "")
                        break
            else:
                messages.insert(0, {"role": "system", "content": thinking_prompt})

        stream_kwargs["messages"] = messages
        stream = await client.chat.completions.create(**stream_kwargs)

        buffer = ""
        in_think_tag = False
        think_tag = "<think>"
        end_think_tag = "</think>"

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                buffer += chunk.choices[0].delta.content

                while True:
                    if not in_think_tag:
                        start_index = buffer.find(think_tag)
                        if start_index != -1:
                            yield buffer[:start_index]
                            buffer = buffer[start_index + len(think_tag):]
                            yield "[REASONING]"
                            in_think_tag = True
                            continue
                        else:
                            if len(buffer) >= len(think_tag):
                                yield_up_to = len(buffer) - (len(think_tag) - 1)
                                yield buffer[:yield_up_to]
                                buffer = buffer[yield_up_to:]
                            break
                    else:
                        end_index = buffer.find(end_think_tag)
                        if end_index != -1:
                            yield buffer[:end_index]
                            buffer = buffer[end_index + len(end_think_tag):]
                            yield "[/REASONING]"
                            in_think_tag = False
                            continue
                        else:
                            if len(buffer) >= len(end_think_tag):
                                yield_up_to = len(buffer) - (len(end_think_tag) - 1)
                                yield buffer[:yield_up_to]
                                buffer = buffer[yield_up_to:]
                            break

        if buffer:
            if in_think_tag:
                yield buffer
                yield "[/REASONING]"
            else:
                yield buffer
