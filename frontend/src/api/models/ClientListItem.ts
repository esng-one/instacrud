/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClientType } from './ClientType';
import type { PydanticObjectId } from './PydanticObjectId';
export type ClientListItem = {
    _id?: PydanticObjectId;
    updated_at?: string;
    code?: string;
    name?: string;
    type?: ClientType;
    description?: string;
};
