/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
export type Project_Input = {
    search_tokens?: Array<string>;
    /**
     * MongoDB document ObjectID
     */
    _id?: (PydanticObjectId | null);
    created_at?: string;
    created_by?: (string | null);
    updated_at?: string;
    updated_by?: (string | null);
    code: string;
    client_id: (PydanticObjectId | null);
    name: string;
    start_date: string;
    end_date?: (string | null);
    description?: (string | null);
};


export const Project_InputRequired = ["code","name","start_date"] as const;
