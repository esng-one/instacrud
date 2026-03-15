/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
export type Contact_Output = {
    search_tokens?: Array<string>;
    /**
     * MongoDB document ObjectID
     */
    _id?: (PydanticObjectId | null);
    created_at?: string;
    created_by?: (string | null);
    updated_at?: string;
    updated_by?: (string | null);
    name: string;
    title?: (string | null);
    email?: (string | null);
    phone?: (string | null);
};


export const Contact_OutputRequired = ["name"] as const;
