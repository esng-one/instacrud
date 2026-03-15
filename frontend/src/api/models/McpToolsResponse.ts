/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { McpToolInfo } from './McpToolInfo';
/**
 * Response containing MCP tools.
 */
export type McpToolsResponse = {
    tools: Array<McpToolInfo>;
};


export const McpToolsResponseRequired = ["tools"] as const;
