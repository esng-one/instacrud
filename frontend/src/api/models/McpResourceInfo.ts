/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Information about an MCP resource.
 */
export type McpResourceInfo = {
    uri: string;
    name: string;
    description?: (string | null);
    mime_type?: (string | null);
};


export const McpResourceInfoRequired = ["uri","name"] as const;
