/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for MCP resource operations.
 */
export type McpResourceRequest = {
    /**
     * MCP server URL
     */
    mcp_server_url: string;
    /**
     * MCP server API key
     */
    mcp_api_key?: (string | null);
    /**
     * Resource URI (for read operations)
     */
    uri?: (string | null);
};


export const McpResourceRequestRequired = ["mcp_server_url"] as const;
