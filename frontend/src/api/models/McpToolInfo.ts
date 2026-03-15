/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Information about an MCP tool.
 */
export type McpToolInfo = {
    name: string;
    description: string;
    input_schema: Record<string, any>;
};


export const McpToolInfoRequired = ["name","description","input_schema"] as const;
