/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClientType } from './ClientType';
import type { PydanticObjectId } from './PydanticObjectId';
/**
 * Projection model for GET /clients list — only fields rendered by ClientGrid.
 *
 * Intentionally omits: search_tokens (internal full-text index, never rendered),
 * contact_ids, address_ids (ID arrays unused by the grid).
 */
export type ClientListItem = {
    updated_at?: (string | null);
    _id?: (PydanticObjectId | null);
    code?: (string | null);
    name?: (string | null);
    type?: (ClientType | null);
    description?: (string | null);
};

