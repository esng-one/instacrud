/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
/**
 * Projection model for GET /projects list — only fields rendered by ProjectGrid.
 *
 * Intentionally omits: search_tokens (internal full-text index, never rendered).
 * client_id is included for the client reference field hook.
 */
export type ProjectListItem = {
    updated_at?: (string | null);
    _id?: (PydanticObjectId | null);
    code?: (string | null);
    name?: (string | null);
    client_id?: (PydanticObjectId | null);
    start_date?: (string | null);
    end_date?: (string | null);
    description?: (string | null);
};

