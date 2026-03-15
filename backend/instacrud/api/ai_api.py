# api/ai_api.py

from typing import Annotated, List
import base64
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from instacrud.api.api_utils import role_required
from instacrud.api.rate_limiter import limiter, AI_RATE_LIMIT, get_user_identifier
from instacrud.api.ai_dto import (
    CompletionRequest,
    CompletionResponse,
    CompletionWithImageRequest,
    EmbeddingRequest,
    EmbeddingResponse,
    ImageGenerationRequest,
    ImageGenerationResponse,
    McpCompletionRequest,
    McpResourceRequest,
    McpToolsResponse,
    McpResourcesResponse,
    McpResourceContentResponse,
    McpToolInfo,
    McpResourceInfo,
)
from instacrud.ai.ai_service import AiServiceClient
from instacrud.ai.usage_tracker import UsageLimitExceeded, TierAccessDenied
from instacrud.model.system_model import AiModel, Role
from instacrud.context import current_user_context

router = APIRouter()


# ------------------------------
# COMPLETION ENDPOINTS
# ------------------------------

@router.post("/completion", response_model=CompletionResponse, tags=["ai"])
@limiter.limit(AI_RATE_LIMIT, key_func=get_user_identifier)
async def create_completion(
    request: Request,
    data: CompletionRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Generate text completion.

    Requires a model with `completion=True`.
    """
    try:
        # Get current user context
        user_ctx = current_user_context.get()

        # Get AI model
        ai_model = await AiModel.find_one(AiModel.model_identifier == data.model_id)
        if not ai_model:
            raise HTTPException(status_code=404, detail=f"Model {data.model_id} not found")

        if not ai_model.completion:
            raise HTTPException(status_code=400, detail=f"Model {data.model_id} does not support completion")

        # Create client with usage tracking
        client = AiServiceClient(ai_model=ai_model, user_id=user_ctx.user_id)

        # Check tier access before streaming to ensure proper error handling
        # (exceptions in streaming generators don't propagate properly)
        await client._check_tier_access()

        if data.stream:
            async def generate():
                total_content = ""
                try:
                    async for chunk in client.get_completion_streaming(data.prompt, reasoning=data.reasoning):
                        total_content += chunk
                        yield chunk
                finally:
                    # Track usage after streaming completes
                    if total_content and user_ctx.user_id:
                        from instacrud.ai.usage_tracker import UsageTracker
                        # Rough estimate: 1 token per 4 characters
                        estimated_tokens = len(total_content) // 4
                        if estimated_tokens > 0:
                            # Calculate cost in credits: (tokens * cost_per_1M) / 1,000,000
                            cost = 0.0
                            if ai_model.output_tokens_cost:
                                cost = (estimated_tokens * ai_model.output_tokens_cost) / 1_000_000
                            else:
                                # Fallback: assume 0.000001 credits per token if no pricing
                                cost = estimated_tokens * 0.000001

                            try:
                                await UsageTracker.check_and_increment_usage(
                                    user_id=user_ctx.user_id,
                                    cost=cost
                                )
                            except Exception as e:
                                # Don't fail the stream if usage tracking fails
                                print(f"Warning: Failed to track streaming usage: {e}")

            return StreamingResponse(generate(), media_type="text/plain")
        else:
            content = await client.get_completion(data.prompt)
            return CompletionResponse(content=content, model_id=data.model_id)

    except TierAccessDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
    except UsageLimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Completion failed: {str(e)}")


@router.post("/completion/image", response_model=CompletionResponse, tags=["ai"])
@limiter.limit(AI_RATE_LIMIT, key_func=get_user_identifier)
async def create_completion_with_image(
    request: Request,
    data: CompletionWithImageRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Generate completion with image input.

    Requires a model with `image_completion=True`.
    Provide either `image_url` or `image_data` (base64 encoded).
    """
    try:
        # Get current user context
        user_ctx = current_user_context.get()

        # Get AI model
        ai_model = await AiModel.find_one(AiModel.model_identifier == data.model_id)
        if not ai_model:
            raise HTTPException(status_code=404, detail=f"Model {data.model_id} not found")

        if not ai_model.image_completion:
            raise HTTPException(status_code=400, detail=f"Model {data.model_id} does not support image completion")

        # Create client with usage tracking
        client = AiServiceClient(ai_model=ai_model, user_id=user_ctx.user_id)

        # Check tier access before streaming to ensure proper error handling
        # (exceptions in streaming generators don't propagate properly)
        await client._check_tier_access()

        # Decode base64 image data if provided
        image_data_bytes = None
        if data.image_data:
            try:
                image_data_bytes = base64.b64decode(data.image_data)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")

        if data.stream:
            async def generate():
                async for chunk in client.get_completion_with_image_streaming(
                    text=data.prompt,
                    image_url=data.image_url,
                    image_data=image_data_bytes,
                    image_media_type=data.image_media_type,
                    image_detail=data.image_detail,
                    reasoning=data.reasoning
                ):
                    yield chunk

            return StreamingResponse(generate(), media_type="text/plain")
        else:
            content = await client.get_completion_with_image(
                text=data.prompt,
                image_url=data.image_url,
                image_data=image_data_bytes,
                image_media_type=data.image_media_type,
                image_detail=data.image_detail
            )
            return CompletionResponse(content=content, model_id=data.model_id)

    except TierAccessDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
    except UsageLimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image completion failed: {str(e)}")


# ------------------------------
# EMBEDDING ENDPOINTS
# ------------------------------

@router.post("/embeddings", response_model=EmbeddingResponse, tags=["ai"])
@limiter.limit(AI_RATE_LIMIT, key_func=get_user_identifier)
async def create_embeddings(
    request: Request,
    data: EmbeddingRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Generate embeddings for text.

    Requires a model with `embedding=True`.
    """
    try:
        # Get current user context
        user_ctx = current_user_context.get()

        # Get AI model
        ai_model = await AiModel.find_one(AiModel.model_identifier == data.model_id)
        if not ai_model:
            raise HTTPException(status_code=404, detail=f"Model {data.model_id} not found")

        if not ai_model.embedding:
            raise HTTPException(status_code=400, detail=f"Model {data.model_id} does not support embeddings")

        # Create client with usage tracking
        client = AiServiceClient(ai_model=ai_model, user_id=user_ctx.user_id)
        embeddings = await client.get_embedding(data.text)

        return EmbeddingResponse(embeddings=embeddings, model_id=data.model_id)

    except TierAccessDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
    except UsageLimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


# ------------------------------
# IMAGE GENERATION ENDPOINTS
# ------------------------------

@router.post("/images/generate", response_model=ImageGenerationResponse, tags=["ai"])
@limiter.limit(AI_RATE_LIMIT, key_func=get_user_identifier)
async def generate_images(
    request: Request,
    data: ImageGenerationRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Generate images from text prompt.

    Requires a model with `image_generation=True`.
    Optionally accepts a reference image for image-to-image generation (if model supports vision).
    """
    try:
        # Get current user context
        user_ctx = current_user_context.get()

        # Get AI model
        ai_model = await AiModel.find_one(AiModel.model_identifier == data.model_id)
        if not ai_model:
            raise HTTPException(status_code=404, detail=f"Model {data.model_id} not found")

        if not ai_model.image_generation:
            raise HTTPException(status_code=400, detail=f"Model {data.model_id} does not support image generation")

        # Check if model supports image input when image_data is provided
        if data.image_data:
            if not ai_model.image_completion:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model {data.model_id} does not support image input for generation"
                )

        # Decode base64 image data if provided
        image_data_bytes = None
        if data.image_data:
            try:
                image_data_bytes = base64.b64decode(data.image_data)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")

        # Create client with usage tracking
        client = AiServiceClient(ai_model=ai_model, user_id=user_ctx.user_id)
        images = await client.generate_image(
            prompt=data.prompt,
            size=data.size,
            quality=data.quality,
            n=data.n,
            response_format=data.response_format,
            image_data=image_data_bytes
        )

        # Convert bytes to base64 if needed
        if data.response_format == "b64_json":
            images = [base64.b64encode(img).decode('utf-8') if isinstance(img, bytes) else img for img in images]

        return ImageGenerationResponse(
            images=images,
            model_id=data.model_id,
            format=data.response_format
        )

    except TierAccessDenied as e:
        raise HTTPException(status_code=403, detail=e.message)
    except UsageLimitExceeded as e:
        raise HTTPException(status_code=429, detail=e.message)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")


# ------------------------------
# MCP ENDPOINTS
# ------------------------------

@router.post("/mcp/completion", response_model=CompletionResponse, tags=["ai", "mcp"])
@limiter.limit(AI_RATE_LIMIT, key_func=get_user_identifier)
async def create_mcp_completion(
    request: Request,
    data: McpCompletionRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Generate completion with MCP tool support.

    The AI can use tools from the specified MCP server to help answer queries.
    """
    try:
        # Get AI model
        ai_model = await AiModel.find_one(AiModel.model_identifier == data.model_id)
        if not ai_model:
            raise HTTPException(status_code=404, detail=f"Model {data.model_id} not found")

        if not ai_model.completion:
            raise HTTPException(status_code=400, detail=f"Model {data.model_id} does not support completion")

        # Create client with MCP
        client = AiServiceClient(
            ai_model=ai_model,
            mcp_server_url=data.mcp_server_url,
            mcp_api_key=data.mcp_api_key
        )

        try:
            # Initialize MCP tools
            await client.initialize_mcp_tools()

            # Get completion with tools
            content = await client.get_completion_with_mcp_tools(
                messages=data.prompt,
                auto_execute_tools=data.auto_execute_tools,
                max_iterations=data.max_iterations
            )

            return CompletionResponse(content=content, model_id=data.model_id)

        finally:
            await client.close()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCP completion failed: {str(e)}")


@router.post("/mcp/tools", response_model=McpToolsResponse, tags=["ai", "mcp"])
async def list_mcp_tools(
    request: McpResourceRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    List available tools from an MCP server.
    """
    try:
        from instacrud.ai.mcp_client import McpClient

        async with McpClient(request.mcp_server_url, request.mcp_api_key) as mcp_client:
            tools = await mcp_client.list_tools()

            return McpToolsResponse(
                tools=[
                    McpToolInfo(
                        name=tool.name,
                        description=tool.description,
                        input_schema=tool.input_schema
                    )
                    for tool in tools
                ]
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list MCP tools: {str(e)}")


@router.post("/mcp/resources", response_model=McpResourcesResponse, tags=["ai", "mcp"])
async def list_mcp_resources(
    request: McpResourceRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    List available resources from an MCP server.
    """
    try:
        from instacrud.ai.mcp_client import McpClient

        async with McpClient(request.mcp_server_url, request.mcp_api_key) as mcp_client:
            resources = await mcp_client.list_resources()

            return McpResourcesResponse(
                resources=[
                    McpResourceInfo(
                        uri=resource.uri,
                        name=resource.name,
                        description=resource.description,
                        mime_type=resource.mime_type
                    )
                    for resource in resources
                ]
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list MCP resources: {str(e)}")


@router.post("/mcp/resources/read", response_model=McpResourceContentResponse, tags=["ai", "mcp"])
async def read_mcp_resource(
    request: McpResourceRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Read a resource from an MCP server.
    """
    if not request.uri:
        raise HTTPException(status_code=400, detail="Resource URI is required")

    try:
        from instacrud.ai.mcp_client import McpClient

        async with McpClient(request.mcp_server_url, request.mcp_api_key) as mcp_client:
            content = await mcp_client.read_resource(request.uri)

            return McpResourceContentResponse(uri=request.uri, content=content)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read MCP resource: {str(e)}")


# ------------------------------
# IMAGE PROXY ENDPOINT
# ------------------------------

@router.get("/images/proxy", tags=["ai"])
async def proxy_image(
    url: str,
    _: Annotated[None, Depends(role_required(Role.RO_USER, Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Proxy external image URLs to avoid CORS issues.

    This is particularly useful for images from DALL-E and FLUX that are hosted on Azure Blob Storage
    with CORS restrictions or SAS tokens that expire.

    The proxy fetches the image from the external URL and serves it with CORS headers,
    bypassing SAS token expiration issues.
    """
    try:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()

            # Get content type from response headers
            content_type = response.headers.get("content-type", "image/png")

            return Response(
                content=response.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "Access-Control-Allow-Origin": "*"
                }
            )

    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image proxy failed: {str(e)}")


# ------------------------------
# USAGE TRACKING ENDPOINTS
# ------------------------------

@router.get("/usage/stats", tags=["ai", "usage"])
async def get_usage_stats(
    _: Annotated[None, Depends(role_required(Role.RO_USER, Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """
    Get current usage statistics for the authenticated user.

    Returns usage for all AI service types (completions, embeddings, images, medias)
    along with tier limits and reset time.
    """
    try:
        from instacrud.ai.usage_tracker import UsageTracker

        # Get current user context
        user_ctx = current_user_context.get()

        # Get usage stats
        stats = await UsageTracker.get_usage_stats(user_ctx.user_id)

        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage stats: {str(e)}")


@router.get("/usage/stats/{organization_id}", tags=["ai", "usage"])
async def get_organization_usage_stats(
    organization_id: str,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    """
    Get usage statistics for an organization.

    ADMIN can query any organization by ID.
    ORG_ADMIN gets their own organization's stats (organization_id parameter is ignored).
    """
    try:
        from instacrud.ai.usage_tracker import UsageTracker
        from beanie import PydanticObjectId

        user_ctx = current_user_context.get()

        # ORG_ADMIN can only see their own organization
        if user_ctx.role == Role.ORG_ADMIN:
            org_id = PydanticObjectId(user_ctx.organization_id)
        else:
            org_id = PydanticObjectId(organization_id)

        stats = await UsageTracker.get_organization_usage_stats(org_id)

        if stats is None:
            raise HTTPException(status_code=404, detail="Organization not found")

        return stats

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage stats: {str(e)}")


@router.post("/usage/stats/bulk", tags=["ai", "usage"])
async def get_bulk_organization_usage_stats(
    organization_ids: List[str],
    _: Annotated[None, Depends(role_required(Role.ADMIN))]
) -> dict[str, float]:
    """
    Get usage values for multiple organizations (admin only).
    Returns a map of organization_id -> usage (number, 0 if none).
    """
    from instacrud.model.system_model import Usage, Organization
    from beanie import PydanticObjectId

    # If empty list, use aggregation to get usage for all orgs in one query
    if not organization_ids:
        pipeline = [
            {"$lookup": {
                "from": "usage",
                "localField": "_id",
                "foreignField": "organization_id",
                "as": "usage_doc"
            }},
            {"$project": {
                "_id": 1,
                "usage": {"$ifNull": [{"$arrayElemAt": ["$usage_doc.usage", 0]}, 0]}
            }}
        ]
        results = await Organization.aggregate(pipeline).to_list()
        return {str(r["_id"]): r["usage"] for r in results}

    # Specific org IDs requested
    org_ids = [PydanticObjectId(oid) for oid in organization_ids]
    usages = await Usage.find({"organization_id": {"$in": org_ids}}).to_list()
    usage_map = {str(u.organization_id): u.usage for u in usages}
    return {oid: usage_map.get(oid, 0) for oid in organization_ids}
