/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CompletionResponse } from '../models/CompletionResponse';
import type { McpCompletionRequest } from '../models/McpCompletionRequest';
import type { McpResourceContentResponse } from '../models/McpResourceContentResponse';
import type { McpResourceRequest } from '../models/McpResourceRequest';
import type { McpResourcesResponse } from '../models/McpResourcesResponse';
import type { McpToolsResponse } from '../models/McpToolsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class McpService {
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
}
