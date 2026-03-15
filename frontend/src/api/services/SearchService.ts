/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Find } from '../models/Find';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SearchService {
    /**
     * Find Entities
     * @param q
     * @returns Find Successful Response
     * @throws ApiError
     */
    public static findEntitiesFindGet(
        q: string,
    ): CancelablePromise<Find> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/find',
            query: {
                'q': q,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Find Entities Semantic
     * Semantic search using vector embeddings.
     *
     * Searches through documents with embeddings using vector similarity.
     * Returns results ranked by semantic relevance to the query.
     *
     * Note: Uses MongoDB Atlas $vectorSearch when available, falls back to
     * in-memory FAISS for local development.
     * @param q
     * @returns Find Successful Response
     * @throws ApiError
     */
    public static findEntitiesSemanticFindSemanticGet(
        q: string,
    ): CancelablePromise<Find> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/find-semantic',
            query: {
                'q': q,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
