/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
export type ProjectDocument_Output = {
    search_tokens?: Array<string>;
    /**
     * MongoDB document ObjectID
     */
    _id?: (PydanticObjectId | null);
    created_at?: string;
    created_by?: (string | null);
    updated_at?: string;
    updated_by?: (string | null);
    project_id: PydanticObjectId;
    code: string;
    name: string;
    content?: (string | null);
    description?: (string | null);
    content_embedding?: (Array<number> | null);
};


export const ProjectDocument_OutputRequired = ["project_id","code","name"] as const;
