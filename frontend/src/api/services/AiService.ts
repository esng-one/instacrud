/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CompletionRequest } from '../models/CompletionRequest';
import type { CompletionResponse } from '../models/CompletionResponse';
import type { CompletionWithImageRequest } from '../models/CompletionWithImageRequest';
import type { EmbeddingRequest } from '../models/EmbeddingRequest';
import type { EmbeddingResponse } from '../models/EmbeddingResponse';
import type { ImageGenerationRequest } from '../models/ImageGenerationRequest';
import type { ImageGenerationResponse } from '../models/ImageGenerationResponse';
import type { McpCompletionRequest } from '../models/McpCompletionRequest';
import type { McpResourceContentResponse } from '../models/McpResourceContentResponse';
import type { McpResourceRequest } from '../models/McpResourceRequest';
import type { McpResourcesResponse } from '../models/McpResourcesResponse';
import type { McpToolsResponse } from '../models/McpToolsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AiService {
    /**
     * Create Completion
     * Generate text completion.
     *
     * Requires a model with `completion=True`.
     * @param requestBody
     * @returns CompletionResponse Successful Response
     * @throws ApiError
     */
    public static createCompletionCompletionPost(
        requestBody: CompletionRequest,
    ): CancelablePromise<CompletionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/completion',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Completion With Image
     * Generate completion with image input.
     *
     * Requires a model with `image_completion=True`.
     * Provide either `image_url` or `image_data` (base64 encoded).
     * @param requestBody
     * @returns CompletionResponse Successful Response
     * @throws ApiError
     */
    public static createCompletionWithImageCompletionImagePost(
        requestBody: CompletionWithImageRequest,
    ): CancelablePromise<CompletionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/completion/image',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Embeddings
     * Generate embeddings for text.
     *
     * Requires a model with `embedding=True`.
     * @param requestBody
     * @returns EmbeddingResponse Successful Response
     * @throws ApiError
     */
    public static createEmbeddingsEmbeddingsPost(
        requestBody: EmbeddingRequest,
    ): CancelablePromise<EmbeddingResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/embeddings',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Generate Images
     * Generate images from text prompt.
     *
     * Requires a model with `image_generation=True`.
     * Optionally accepts a reference image for image-to-image generation (if model supports vision).
     * @param requestBody
     * @returns ImageGenerationResponse Successful Response
     * @throws ApiError
     */
    public static generateImagesImagesGeneratePost(
        requestBody: ImageGenerationRequest,
    ): CancelablePromise<ImageGenerationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/images/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Mcp Completion
     * Generate completion with MCP tool support.
     *
     * The AI can use tools from the specified MCP server to help answer queries.
     * @param requestBody
     * @returns CompletionResponse Successful Response
     * @throws ApiError
     */
    public static createMcpCompletionMcpCompletionPost(
        requestBody: McpCompletionRequest,
    ): CancelablePromise<CompletionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/completion',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Mcp Tools
     * List available tools from an MCP server.
     * @param requestBody
     * @returns McpToolsResponse Successful Response
     * @throws ApiError
     */
    public static listMcpToolsMcpToolsPost(
        requestBody: McpResourceRequest,
    ): CancelablePromise<McpToolsResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/tools',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Mcp Resources
     * List available resources from an MCP server.
     * @param requestBody
     * @returns McpResourcesResponse Successful Response
     * @throws ApiError
     */
    public static listMcpResourcesMcpResourcesPost(
        requestBody: McpResourceRequest,
    ): CancelablePromise<McpResourcesResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/resources',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Read Mcp Resource
     * Read a resource from an MCP server.
     * @param requestBody
     * @returns McpResourceContentResponse Successful Response
     * @throws ApiError
     */
    public static readMcpResourceMcpResourcesReadPost(
        requestBody: McpResourceRequest,
    ): CancelablePromise<McpResourceContentResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/mcp/resources/read',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Proxy Image
     * Proxy external image URLs to avoid CORS issues.
     *
     * This is particularly useful for images from DALL-E and FLUX that are hosted on Azure Blob Storage
     * with CORS restrictions or SAS tokens that expire.
     *
     * The proxy fetches the image from the external URL and serves it with CORS headers,
     * bypassing SAS token expiration issues.
     * @param url
     * @returns any Successful Response
     * @throws ApiError
     */
    public static proxyImageImagesProxyGet(
        url: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/images/proxy',
            query: {
                'url': url,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Usage Stats
     * Get current usage statistics for the authenticated user.
     *
     * Returns usage for all AI service types (completions, embeddings, images, medias)
     * along with tier limits and reset time.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getUsageStatsUsageStatsGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/usage/stats',
        });
    }
    /**
     * Get Organization Usage Stats
     * Get usage statistics for an organization.
     *
     * ADMIN can query any organization by ID.
     * ORG_ADMIN gets their own organization's stats (organization_id parameter is ignored).
     * @param organizationId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getOrganizationUsageStatsUsageStatsOrganizationIdGet(
        organizationId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/usage/stats/{organization_id}',
            path: {
                'organization_id': organizationId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Bulk Organization Usage Stats
     * Get usage values for multiple organizations (admin only).
     * Returns a map of organization_id -> usage (number, 0 if none).
     * @param requestBody
     * @returns number Successful Response
     * @throws ApiError
     */
    public static getBulkOrganizationUsageStatsUsageStatsBulkPost(
        requestBody: Array<string>,
    ): CancelablePromise<Record<string, number>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/usage/stats/bulk',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
