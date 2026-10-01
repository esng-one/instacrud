"""Retired AI models: startup disables them, and OpenAI image generation rejects them."""

import pytest

from instacrud.ai.ai_service_vision import OpenAIImageGenerator
from instacrud.app import disable_retired_ai_models
from instacrud.model.system_model import AiModel, AiServiceProvider


def _model(identifier: str, enabled: bool = True) -> AiModel:
    return AiModel(
        service=AiServiceProvider.OPEN_AI,
        name=identifier,
        model_identifier=identifier,
        completion=False,
        image_generation=True,
        enabled=enabled,
    )


@pytest.mark.asyncio
async def test_openai_image_rejects_non_gpt_image_model(initialized_system_db):
    """A leftover DALL-E row fails fast with a clear error, before any network call (nothing is saved)."""
    with pytest.raises(ValueError, match="Unsupported OpenAI image model: dall-e-3"):
        await OpenAIImageGenerator(_model("dall-e-3")).generate("a cat", "1024x1024", "standard", 1, "url", None)


@pytest.mark.asyncio
async def test_disable_retired_ai_models(initialized_system_db, test_mode):
    # Touches every retired row in the DB, so only against the throwaway mock DB
    if test_mode != "mock":
        pytest.skip("Updates all retired model rows; mock mode only")

    retired = _model("dall-e-3")
    kept = _model(f"gpt-image-test-{id(retired)}")
    await retired.insert()
    await kept.insert()
    try:
        await disable_retired_ai_models()
        assert (await AiModel.get(retired.id)).enabled is False
        assert (await AiModel.get(kept.id)).enabled is True
    finally:
        await retired.delete()
        await kept.delete()
