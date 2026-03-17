/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OrganizationResponse = {
    id: string;
    name: string;
    code: string;
    description?: (string | null);
    status?: string;
    tier_id?: (string | null);
    local_only_conversations?: boolean;
};


export const OrganizationResponseRequired = ["id","name","code"] as const;
