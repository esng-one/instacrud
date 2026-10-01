/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PydanticObjectId } from './PydanticObjectId';
/**
 * Projection model for GET /documents list — only fields rendered by DocumentGrid.
 *
 * Intentionally omits: search_tokens (internal full-text index, never rendered),
 * content_embedding (1536-dim float array; not needed in list — heatmap only
 * renders in expanded accordion, which can lazy-load from the detail endpoint).
 */
export type ProjectDocumentListItem = {
    updated_at?: (string | null);
    _id?: (PydanticObjectId | null);
    project_id?: (PydanticObjectId | null);
    code?: (string | null);
    name?: (string | null);
    content?: (string | null);
    description?: (string | null);
};

