/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
export type Tier_Input = {
    /**
     * MongoDB document ObjectID
     */
    _id?: (PydanticObjectId | null);
    created_at?: string;
    created_by?: (string | null);
    updated_at?: string;
    updated_by?: (string | null);
    tier: number;
    name: string;
    code: string;
    description?: (string | null);
    usage?: (number | null);
    cost?: (number | null);
    active?: boolean;
};


export const Tier_InputRequired = ["tier","name","code"] as const;
