/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OrganizationCreate = {
    name: string;
    code: string;
    description?: (string | null);
    tier_id?: (string | null);
    local_only_conversations?: boolean;
};


export const OrganizationCreateRequired = ["name","code"] as const;
