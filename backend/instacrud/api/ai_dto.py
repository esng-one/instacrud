# api/ai_dto.py

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal


# ------------------------------
# REQUEST MODELS
# ------------------------------

class CompletionRequest(BaseModel):
    """Request for text completion."""
    prompt: str = Field(..., description="The prompt for completion")
    model_id: str = Field(..., description="AI model ID to use")
    stream: bool = Field(default=False, description="Enable streaming response")
    reasoning: bool = Field(default=False, description="Enable reasoning/chain-of-thought mode")


class CompletionWithImageRequest(BaseModel):
    """Request for completion with image input."""
    prompt: str = Field(..., description="Text prompt")
    model_id: str = Field(..., description="AI model ID to use")
    image_url: Optional[str] = Field(None, description="URL of the image")
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")
    image_media_type: Optional[str] = Field(None, description="MIME type (e.g., 'image/jpeg')")
    image_detail: str = Field(default="auto", description="Detail level: 'low', 'high', or 'auto'")
    stream: bool = Field(default=False, description="Enable streaming response")
    reasoning: bool = Field(default=False, description="Enable reasoning/chain-of-thought mode")


class EmbeddingRequest(BaseModel):
    """Request for generating embeddings."""
    text: List[str] | str = Field(..., description="Text(s) to generate embeddings for")
    model_id: str = Field(..., description="AI model ID to use")


class ImageGenerationRequest(BaseModel):
    """Request for image generation."""
    prompt: str = Field(..., description="Text description of the image")
    model_id: str = Field(..., description="AI model ID to use")
    size: str = Field(default="1024x1024", description="Image size (e.g., '1024x1024', '512x512')")
    quality: str = Field(default="standard", description="Image quality (e.g., 'standard', 'hd')")
    n: int = Field(default=1, ge=1, le=10, description="Number of images to generate")
    response_format: Literal["url", "b64_json"] = Field(default="url", description="Response format")
    image_data: Optional[str] = Field(None, description="Base64 encoded reference image for image-to-image generation")


class McpCompletionRequest(BaseModel):
    """Request for completion with MCP tools."""
    prompt: str = Field(..., description="The prompt for completion")
    model_id: str = Field(..., description="AI model ID to use")
    mcp_server_url: str = Field(..., description="MCP server URL")
    mcp_api_key: Optional[str] = Field(None, description="MCP server API key")
    auto_execute_tools: bool = Field(default=True, description="Automatically execute tool calls")
    max_iterations: int = Field(default=5, ge=1, le=20, description="Maximum tool execution iterations")


class McpResourceRequest(BaseModel):
    """Request for MCP resource operations."""
    mcp_server_url: str = Field(..., description="MCP server URL")
    mcp_api_key: Optional[str] = Field(None, description="MCP server API key")
    uri: Optional[str] = Field(None, description="Resource URI (for read operations)")


# ------------------------------
# RESPONSE MODELS
# ------------------------------

class CompletionResponse(BaseModel):
    """Response for text completion."""
    content: str = Field(..., description="Generated completion text")
    model_id: str = Field(..., description="Model used for generation")
    reasoning_content: Optional[str] = Field(None, description="Chain of thought content (if reasoning was enabled)")


class EmbeddingResponse(BaseModel):
    """Response for embeddings."""
    embeddings: List[List[float]] | List[float] = Field(..., description="Generated embeddings")
    model_id: str = Field(..., description="Model used for generation")


class ImageGenerationResponse(BaseModel):
    """Response for image generation."""
    images: List[str] = Field(..., description="Generated image URLs or base64 data")
    model_id: str = Field(..., description="Model used for generation")
    format: str = Field(..., description="Response format (url or b64_json)")


class McpToolInfo(BaseModel):
    """Information about an MCP tool."""
    name: str
    description: str
    input_schema: Dict[str, Any]


class McpToolsResponse(BaseModel):
    """Response containing MCP tools."""
    tools: List[McpToolInfo]


class McpResourceInfo(BaseModel):
    """Information about an MCP resource."""
    uri: str
    name: str
    description: Optional[str] = None
    mime_type: Optional[str] = None


class McpResourcesResponse(BaseModel):
    """Response containing MCP resources."""
    resources: List[McpResourceInfo]


class McpResourceContentResponse(BaseModel):
    """Response containing MCP resource content."""
    uri: str
    content: Dict[str, Any]


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: Optional[str] = None
