/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Tier_Input } from '../models/Tier_Input';
import type { Tier_Output } from '../models/Tier_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TiersService {
    /**
     * Create Item
     * @param requestBody
     * @returns Tier_Output Successful Response
     * @throws ApiError
     */
    public static createItemAdminTiersPost(
        requestBody: Tier_Input,
    ): CancelablePromise<Tier_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/tiers',
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
     * @returns Tier_Output Successful Response
     * @throws ApiError
     */
    public static listItemsAdminTiersGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<Tier_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/tiers',
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
     * @returns Tier_Output Successful Response
     * @throws ApiError
     */
    public static getItemAdminTiersItemIdGet(
        itemId: string,
    ): CancelablePromise<Tier_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/tiers/{item_id}',
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
     * @returns Tier_Output Successful Response
     * @throws ApiError
     */
    public static updateItemAdminTiersItemIdPut(
        itemId: string,
        requestBody: Tier_Input,
    ): CancelablePromise<Tier_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/admin/tiers/{item_id}',
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
     * @returns Tier_Output Successful Response
     * @throws ApiError
     */
    public static patchItemAdminTiersItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<Tier_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/admin/tiers/{item_id}',
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
    public static deleteItemAdminTiersItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/admin/tiers/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
