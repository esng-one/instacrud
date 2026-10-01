/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
/**
 * Projection model for GET /contacts list — only fields rendered by ContactGrid.
 *
 * Intentionally omits: search_tokens (internal full-text index, never rendered).
 */
export type ContactListItem = {
    updated_at?: (string | null);
    _id?: (PydanticObjectId | null);
    name?: (string | null);
    title?: (string | null);
    email?: (string | null);
    phone?: (string | null);
};

