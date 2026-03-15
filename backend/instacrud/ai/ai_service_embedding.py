from typing import Union, List, Optional, Any
from beanie import PydanticObjectId
from langchain_openai import OpenAIEmbeddings
from instacrud.model.system_model import AiModel, AiServiceProvider
from instacrud.config import settings
from instacrud.ai.usage_tracker import UsageTracker


class EmbeddingMixin:
    """Mixin providing embedding-related methods for AiServiceClient."""

    ai_model: AiModel
    user_id: Any
    track_usage: bool

    async def _check_tier_access(self) -> None:
        """To be implemented by the main class."""
        raise NotImplementedError

    def _create_embeddings(self):
        if self.ai_model.service == AiServiceProvider.OPEN_AI:
            return OpenAIEmbeddings(model=self.ai_model.model_identifier)
        elif self.ai_model.service == AiServiceProvider.DEEP_INFRA:
            api_key = getattr(settings, "DEEP_INFRA_KEY", None)
            return OpenAIEmbeddings(
                model=self.ai_model.model_identifier,
                openai_api_key=api_key,
                openai_api_base="https://api.deepinfra.com/v1/openai",
                check_embedding_ctx_length=False
            )
        else:
            raise ValueError(f"Unsupported AI service for embeddings: {self.ai_model.service}")

    async def get_embedding(self, text: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        await self._check_tier_access()

        if not self.ai_model.embedding:
            raise ValueError(f"Model {self.ai_model.name} does not support embeddings")

        embeddings = self._create_embeddings()

        if isinstance(text, str):
            estimated_tokens = len(text) // 4
            result = await embeddings.aembed_query(text)
        else:
            estimated_tokens = sum(len(t) // 4 for t in text)
            result = await embeddings.aembed_documents(text)

        if self.track_usage and self.user_id:
            cost = 0.0
            if self.ai_model.input_tokens_cost:
                cost = (estimated_tokens * self.ai_model.input_tokens_cost) / 1_000_000
            else:
                cost = estimated_tokens * 0.000001

            await UsageTracker.check_and_increment_usage(
                user_id=self.user_id,
                cost=cost
            )

        return result


async def get_default_embedding_model() -> Optional[AiModel]:

    default_model = await AiModel.find_one(
        AiModel.model_identifier == settings.DEFAULT_EMBEDDING_MODEL,
        AiModel.embedding == True,
        AiModel.enabled == True
    )

    if default_model:
        return default_model

    return await AiModel.find_one(
        AiModel.embedding == True,
        AiModel.enabled == True
    )


async def calculate_content_embedding(
    content: str,
    user_id: Optional[PydanticObjectId] = None,
    track_usage: bool = True
) -> Optional[List[float]]:
    """Calculate embeddings for text content using the default embedding model."""
    if not content or not content.strip():
        return None

    embedding_model = await get_default_embedding_model()

    if not embedding_model:
        return None

    try:
        from instacrud.ai.ai_service import AiServiceClient
        ai_client = AiServiceClient(
            ai_model=embedding_model,
            user_id=user_id,
            track_usage=track_usage
        )

        embedding = await ai_client.get_embedding(content)
        return embedding
    except Exception as e:
        print(f"Warning: Failed to calculate embedding: {str(e)}")
        return None
