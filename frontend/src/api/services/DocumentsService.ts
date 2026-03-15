/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ProjectDocument_Input } from '../models/ProjectDocument_Input';
import type { ProjectDocument_Output } from '../models/ProjectDocument_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DocumentsService {
    /**
     * Create Item
     * @param requestBody
     * @returns ProjectDocument_Output Successful Response
     * @throws ApiError
     */
    public static createItemDocumentsPost(
        requestBody: ProjectDocument_Input,
    ): CancelablePromise<ProjectDocument_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/documents',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Items
     * Returns a paginated list of documents.
     * Supports:
     * - $in, $and, $or filters
     * - Automatic ObjectId coercion for *_id / *_ids fields
     * @param skip
     * @param limit
     * @param filters
     * @returns ProjectDocument_Output Successful Response
     * @throws ApiError
     */
    public static listItemsDocumentsGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<ProjectDocument_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/documents',
            query: {
                'skip': skip,
                'limit': limit,
                'filters': filters,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Item
     * @param itemId
     * @returns ProjectDocument_Output Successful Response
     * @throws ApiError
     */
    public static getItemDocumentsItemIdGet(
        itemId: string,
    ): CancelablePromise<ProjectDocument_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/documents/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Item
     * @param itemId
     * @param requestBody
     * @returns ProjectDocument_Output Successful Response
     * @throws ApiError
     */
    public static updateItemDocumentsItemIdPut(
        itemId: string,
        requestBody: ProjectDocument_Input,
    ): CancelablePromise<ProjectDocument_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/documents/{item_id}',
            path: {
                'item_id': itemId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Patch Item
     * @param itemId
     * @param requestBody
     * @returns ProjectDocument_Output Successful Response
     * @throws ApiError
     */
    public static patchItemDocumentsItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<ProjectDocument_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/documents/{item_id}',
            path: {
                'item_id': itemId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Item
     * @param itemId
     * @returns void
     * @throws ApiError
     */
    public static deleteItemDocumentsItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/documents/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Recalculate Document Embedding
     * Force recalculate the content embedding for a specific document.
     *
     * This endpoint:
     * - Retrieves the document by ID
     * - Recalculates the embedding from the content field
     * - Saves the updated embedding to the database
     * @param documentId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static recalculateDocumentEmbeddingDocumentsDocumentIdRecalculateEmbeddingPost(
        documentId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/documents/{document_id}/recalculate-embedding',
            path: {
                'document_id': documentId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Recalculate All Document Embeddings
     * Force recalculate embeddings for all documents that have content.
     *
     * This is useful for:
     * - Initial setup of embeddings on existing documents
     * - Switching to a new embedding model
     * - Fixing documents with missing embeddings
     *
     * Returns statistics about the operation.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static recalculateAllDocumentEmbeddingsDocumentsRecalculateEmbeddingsAllPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/documents/recalculate-embeddings-all',
        });
    }
}
