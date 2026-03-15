/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClientType } from './ClientType';
import type { PydanticObjectId } from './PydanticObjectId';
export type Client_Input = {
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
    name: string;
    type: ClientType;
    contact_ids?: (Array<PydanticObjectId> | null);
    address_ids?: (Array<PydanticObjectId> | null);
    description?: (string | null);
};


export const Client_InputRequired = ["code","name","type"] as const;
