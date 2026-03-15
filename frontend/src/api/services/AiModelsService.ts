/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiModel_Input } from '../models/AiModel_Input';
import type { AiModel_Output } from '../models/AiModel_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AiModelsService {
    /**
     * Create Item
     * @param requestBody
     * @returns AiModel_Output Successful Response
     * @throws ApiError
     */
    public static createItemAdminAiModelsPost(
        requestBody: AiModel_Input,
    ): CancelablePromise<AiModel_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/ai-models',
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
     * @returns AiModel_Output Successful Response
     * @throws ApiError
     */
    public static listItemsAdminAiModelsGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<AiModel_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/ai-models',
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
     * @returns AiModel_Output Successful Response
     * @throws ApiError
     */
    public static getItemAdminAiModelsItemIdGet(
        itemId: string,
    ): CancelablePromise<AiModel_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/ai-models/{item_id}',
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
     * @returns AiModel_Output Successful Response
     * @throws ApiError
     */
    public static updateItemAdminAiModelsItemIdPut(
        itemId: string,
        requestBody: AiModel_Input,
    ): CancelablePromise<AiModel_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/admin/ai-models/{item_id}',
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
     * @returns AiModel_Output Successful Response
     * @throws ApiError
     */
    public static patchItemAdminAiModelsItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<AiModel_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/admin/ai-models/{item_id}',
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
    public static deleteItemAdminAiModelsItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/admin/ai-models/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
