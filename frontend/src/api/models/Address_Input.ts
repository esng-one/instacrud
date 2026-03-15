/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
export type Address_Input = {
    /**
     * MongoDB document ObjectID
     */
    _id?: (PydanticObjectId | null);
    created_at?: string;
    created_by?: (string | null);
    updated_at?: string;
    updated_by?: (string | null);
    street: string;
    street2?: (string | null);
    city: string;
    state: string;
    zip_code: string;
    country?: string;
};


export const Address_InputRequired = ["street","city","state","zip_code"] as const;
