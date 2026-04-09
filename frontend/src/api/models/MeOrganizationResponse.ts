/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MeOrganizationResponse = {
    id: string;
    name: string;
    code: string;
    description: (string | null);
    local_only_conversations: boolean;
    tier_id: (string | null);
};


export const MeOrganizationResponseRequired = ["id","name","code","local_only_conversations"] as const;
