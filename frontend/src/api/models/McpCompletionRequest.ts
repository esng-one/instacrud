/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for completion with MCP tools.
 */
export type McpCompletionRequest = {
    /**
     * The prompt for completion
     */
    prompt: string;
    /**
     * AI model ID to use
     */
    model_id: string;
    /**
     * MCP server URL
     */
    mcp_server_url: string;
    /**
     * MCP server API key
     */
    mcp_api_key?: (string | null);
    /**
     * Automatically execute tool calls
     */
    auto_execute_tools?: boolean;
    /**
     * Maximum tool execution iterations
     */
    max_iterations?: number;
};


export const McpCompletionRequestRequired = ["prompt","model_id","mcp_server_url"] as const;
