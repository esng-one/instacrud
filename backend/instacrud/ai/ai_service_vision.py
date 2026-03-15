from typing import Union, List, AsyncIterator, Dict, Any, Optional, Literal
from abc import ABC, abstractmethod
import base64
import httpx
from langchain_core.messages import HumanMessage
from instacrud.model.system_model import AiModel, AiServiceProvider
from instacrud.config import settings
from instacrud.utils import detect_image_type
from instacrud.ai.usage_tracker import UsageTracker
from openai import AsyncOpenAI
from loguru import logger


async def download_image_as_base64(url: str) -> str:
    """Download an image from a URL and convert it to base64 data URL."""
    logger.info(f"Downloading image from URL: {url[:100]}...")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()

        image_bytes = response.content
        content_type = response.headers.get("content-type", "image/png")
        if content_type.startswith("image/"):
            media_type = content_type
        else:
            media_type = detect_image_type(image_bytes)

        base64_data = base64.b64encode(image_bytes).decode('utf-8')
        logger.info(f"Successfully downloaded and converted image to base64 ({len(image_bytes)} bytes)")

        return f"data:{media_type};base64,{base64_data}"


class ImageGenerator(ABC):
    """Abstract base class for image generation providers."""

    def __init__(self, ai_model: AiModel):
        self.ai_model = ai_model

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        size: str,
        quality: str,
        n: int,
        response_format: Literal["url", "b64_json"],
        image_data: Optional[bytes]
    ) -> List[Any]:
        """Generate images and return list of URLs or binary data."""
        pass


class OpenAIImageGenerator(ImageGenerator):
    """Image generator for OpenAI (DALL-E and GPT-Image models)."""

    async def generate(
        self,
        prompt: str,
        size: str,
        quality: str,
        n: int,
        response_format: Literal["url", "b64_json"],
        image_data: Optional[bytes]
    ) -> List[Any]:
        client = AsyncOpenAI()
        is_gpt_image = "gpt-image" in self.ai_model.model_identifier.lower()

        if is_gpt_image:
            return await self._generate_gpt_image(client, prompt, size, quality, n, response_format, image_data)
        else:
            return await self._generate_dalle(client, prompt, size, quality, n, response_format, image_data)

    async def _generate_gpt_image(
        self,
        client: AsyncOpenAI,
        prompt: str,
        size: str,
        quality: str,
        n: int,
        response_format: Literal["url", "b64_json"],
        image_data: Optional[bytes]
    ) -> List[Any]:
        quality_mapping = {"standard": "medium", "hd": "high"}
        gpt_quality = quality_mapping.get(quality, quality)

        if image_data:
            import io
            image_buffer = io.BytesIO(image_data)
            image_buffer.name = "image.png"
            image_buffer.seek(0)

            response = await client.images.edit(
                model=self.ai_model.model_identifier,
                image=image_buffer,
                prompt=prompt,
                size=size,
                n=n
            )
        else:
            response = await client.images.generate(
                model=self.ai_model.model_identifier,
                prompt=prompt,
                size=size,
                quality=gpt_quality,
                n=n,
            )

        return await self._process_response(response, response_format)

    async def _generate_dalle(
        self,
        client: AsyncOpenAI,
        prompt: str,
        size: str,
        quality: str,
        n: int,
        response_format: Literal["url", "b64_json"],
        image_data: Optional[bytes]
    ) -> List[Any]:
        if image_data:
            raise ValueError(f"Model {self.ai_model.name} does not support image-to-image generation")

        response = await client.images.generate(
            model=self.ai_model.model_identifier,
            prompt=prompt,
            size=size,
            quality=quality,
            n=n,
            response_format="b64_json"
        )

        return await self._process_response(response, response_format)

    async def _process_response(
        self,
        response: Any,
        response_format: Literal["url", "b64_json"]
    ) -> List[Any]:
        results = []
        for image in response.data:
            if hasattr(image, 'b64_json') and image.b64_json:
                if response_format == "url":
                    results.append(f"data:image/png;base64,{image.b64_json}")
                else:
                    results.append(base64.b64decode(image.b64_json))
            elif hasattr(image, 'url') and image.url:
                data_url = await download_image_as_base64(image.url)
                if response_format == "url":
                    results.append(data_url)
                else:
                    results.append(base64.b64decode(data_url.split("base64,")[1]))
        return results


class DeepInfraImageGenerator(ImageGenerator):
    """Image generator for DeepInfra (FLUX, Stable Diffusion, Qwen models)."""

    def __init__(self, ai_model: AiModel):
        super().__init__(ai_model)
        self.api_key = getattr(settings, "DEEP_INFRA_KEY", None)
        if not self.api_key:
            raise ValueError("DEEP_INFRA_KEY not configured in settings")

    async def generate(
        self,
        prompt: str,
        size: str,
        quality: str,
        n: int,
        response_format: Literal["url", "b64_json"],
        image_data: Optional[bytes]
    ) -> List[Any]:
        model_id = self.ai_model.model_identifier.lower()

        if image_data:
            if "qwen-image-edit" in model_id:
                return await self._generate_qwen_edit(prompt, size, n, response_format, image_data)
            elif self._supports_image_input():
                return await self._generate_flux_image_to_image(prompt, size, n, response_format, image_data)
            else:
                raise ValueError(f"Model {self.ai_model.name} does not support image-to-image generation")
        else:
            return await self._generate_text_to_image(prompt, size, n, response_format)

    def _supports_image_input(self) -> bool:
        model_id = self.ai_model.model_identifier.lower()
        return (
            self.ai_model.image_completion or
            "flux-2" in model_id or
            "flux.2" in model_id
        )

    async def _generate_qwen_edit(
        self,
        prompt: str,
        size: str,
        n: int,
        response_format: Literal["url", "b64_json"],
        image_data: bytes
    ) -> List[Any]:
        async with httpx.AsyncClient(timeout=120.0) as http_client:
            files = {"image": ("image.png", image_data, "image/png")}
            data = {
                "model": self.ai_model.model_identifier,
                "prompt": prompt,
                "n": str(n),
                "size": size,
            }

            api_response = await http_client.post(
                "https://api.deepinfra.com/v1/openai/images/edits",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files=files,
                data=data,
            )
            api_response.raise_for_status()
            result = api_response.json()

            return self._extract_images_from_response(result.get("data", []), response_format)

    async def _generate_flux_image_to_image(
        self,
        prompt: str,
        size: str,
        n: int,
        response_format: Literal["url", "b64_json"],
        image_data: bytes
    ) -> List[Any]:
        encoded_image = base64.b64encode(image_data).decode('utf-8')
        width, height = map(int, size.split('x'))

        request_data = {
            "prompt": prompt,
            "input_image": encoded_image,
            "width": width,
            "height": height,
        }

        async with httpx.AsyncClient(timeout=120.0) as http_client:
            api_response = await http_client.post(
                f"https://api.deepinfra.com/v1/inference/{self.ai_model.model_identifier}",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=request_data,
            )
            api_response.raise_for_status()
            result = api_response.json()

            images_data = await self._extract_native_api_images(result)
            return await self._process_image_list(images_data, response_format)

    async def _extract_native_api_images(self, result: Dict[str, Any]) -> List[str]:
        """Extract images from DeepInfra native API response."""
        if "image_url" in result:
            data_url = await download_image_as_base64(result["image_url"])
            return [data_url]
        elif "images" in result:
            return result["images"]
        elif "image" in result:
            return [result["image"]]
        else:
            raise ValueError(f"Unexpected response format from DeepInfra. Keys: {list(result.keys())}")

    async def _generate_text_to_image(
        self,
        prompt: str,
        size: str,
        n: int,
        response_format: Literal["url", "b64_json"]
    ) -> List[Any]:
        client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.deepinfra.com/v1/openai"
        )

        params = {
            "model": self.ai_model.model_identifier,
            "prompt": prompt,
            "n": n,
            "response_format": "b64_json"
        }

        model_id = self.ai_model.model_identifier.lower()
        if any(x in model_id for x in ["flux", "stable-diffusion", "sdxl", "sd3"]):
            params["size"] = size

        response = await client.images.generate(**params)

        results = []
        for image in response.data:
            if hasattr(image, 'b64_json') and image.b64_json:
                if response_format == "url":
                    results.append(f"data:image/png;base64,{image.b64_json}")
                else:
                    results.append(base64.b64decode(image.b64_json))
            elif hasattr(image, 'url') and image.url:
                data_url = await download_image_as_base64(image.url)
                if response_format == "url":
                    results.append(data_url)
                else:
                    results.append(base64.b64decode(data_url.split("base64,")[1]))
        return results

    def _extract_images_from_response(
        self,
        images_data: List[Dict[str, Any]],
        response_format: Literal["url", "b64_json"]
    ) -> List[Any]:
        results = []
        for img_obj in images_data:
            b64_data = img_obj.get("b64_json")
            if b64_data:
                if response_format == "url":
                    results.append(f"data:image/png;base64,{b64_data}")
                else:
                    results.append(base64.b64decode(b64_data))
        return results

    async def _process_image_list(
        self,
        images: List[str],
        response_format: Literal["url", "b64_json"]
    ) -> List[Any]:
        results = []
        for img in images:
            if img.startswith("http://") or img.startswith("https://"):
                data_url = await download_image_as_base64(img)
                if response_format == "url":
                    results.append(data_url)
                else:
                    results.append(base64.b64decode(data_url.split("base64,")[1]))
            elif img.startswith("data:image/"):
                if response_format == "url":
                    results.append(img)
                else:
                    results.append(base64.b64decode(img.split("base64,")[1]))
            else:
                if response_format == "url":
                    results.append(f"data:image/png;base64,{img}")
                else:
                    results.append(base64.b64decode(img))
        return results


def get_image_generator(ai_model: AiModel) -> ImageGenerator:
    """Factory function to get the appropriate image generator for a model."""
    generators = {
        AiServiceProvider.OPEN_AI: OpenAIImageGenerator,
        AiServiceProvider.DEEP_INFRA: DeepInfraImageGenerator,
    }

    generator_class = generators.get(ai_model.service)
    if not generator_class:
        raise ValueError(f"Image generation not supported for service: {ai_model.service}")

    return generator_class(ai_model)


class VisionMixin:
    """Mixin providing vision/image-related methods for AiServiceClient."""

    ai_model: AiModel
    model: Any
    user_id: Any
    track_usage: bool

    async def _check_tier_access(self) -> None:
        """To be implemented by the main class."""
        raise NotImplementedError

    async def _stream_with_reasoning(self, messages: List[Any]) -> AsyncIterator[str]:
        """To be implemented by the main class."""
        raise NotImplementedError

    def _prepare_image_content(
        self,
        text: str,
        image_url: Optional[str],
        image_data: Optional[bytes],
        image_media_type: Optional[str],
        image_detail: str
    ) -> List[Dict[str, Any]]:
        """Prepare image content for vision API calls."""
        if image_data:
            if not image_media_type:
                image_media_type = detect_image_type(image_data)
            encoded_image = base64.b64encode(image_data).decode('utf-8')
            image_url = f"data:{image_media_type};base64,{encoded_image}"
        elif not image_url:
            raise ValueError("Either image_url or image_data must be provided")

        return [
            {"type": "text", "text": text},
            {
                "type": "image_url",
                "image_url": {
                    "url": image_url,
                    "detail": image_detail
                }
            }
        ]

    async def get_completion_with_image(
        self,
        text: str,
        image_url: Union[str, bytes] = None,
        image_data: bytes = None,
        image_media_type: Optional[str] = None,
        image_detail: str = "auto"
    ) -> str:
        await self._check_tier_access()

        if not self.ai_model.image_completion:
            raise ValueError(f"Model {self.ai_model.name} does not support image completion")

        content = self._prepare_image_content(text, image_url, image_data, image_media_type, image_detail)
        message = HumanMessage(content=content)
        response = await self.model.ainvoke([message])
        return response.content

    async def get_completion_with_image_streaming(
        self,
        text: str,
        image_url: Union[str, bytes] = None,
        image_data: bytes = None,
        image_media_type: Optional[str] = None,
        image_detail: str = "auto",
        reasoning: bool = False
    ) -> AsyncIterator[str]:
        await self._check_tier_access()

        if not self.ai_model.image_completion:
            raise ValueError(f"Model {self.ai_model.name} does not support image completion")

        content = self._prepare_image_content(text, image_url, image_data, image_media_type, image_detail)
        message = HumanMessage(content=content)

        if reasoning and self.ai_model.reasoning:
            async for chunk in self._stream_with_reasoning([message]):
                yield chunk
            return

        async for chunk in self.model.astream([message]):
            if hasattr(chunk, 'content') and chunk.content:
                yield chunk.content

    async def generate_image(
        self,
        prompt: str,
        size: str = "1024x1024",
        quality: str = "standard",
        n: int = 1,
        response_format: Literal["url", "b64_json"] = "url",
        image_data: Optional[bytes] = None
    ) -> Union[List[str], List[bytes]]:
        """Generate image(s) from text prompt, optionally using a reference image."""
        await self._check_tier_access()

        if not self.ai_model.image_generation:
            raise ValueError(f"Model {self.ai_model.name} does not support image generation")

        generator = get_image_generator(self.ai_model)
        results = await generator.generate(prompt, size, quality, n, response_format, image_data)

        if self.track_usage and self.user_id:
            await self._track_image_usage(n)

        return results

    async def _track_image_usage(self, num_images: int) -> None:
        """Track image generation usage."""
        if not self.user_id:
            return

        cost = 0.0
        if self.ai_model.input_tokens_cost:
            cost = num_images * self.ai_model.input_tokens_cost
        else:
            cost = num_images * 0.01

        await UsageTracker.check_and_increment_usage(
            user_id=self.user_id,
            cost=cost
        )
