/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
export type ProjectListItem = {
    _id?: PydanticObjectId;
    updated_at?: string;
    code?: string;
    name?: string;
    client_id?: PydanticObjectId;
    start_date?: string;
    end_date?: string;
    description?: string;
};
