/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
export type ProjectDocumentListItem = {
    _id?: PydanticObjectId;
    updated_at?: string;
    project_id?: PydanticObjectId;
    code?: string;
    name?: string;
    content?: string;
    description?: string;
};
