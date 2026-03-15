/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Address_Input } from '../models/Address_Input';
import type { Address_Output } from '../models/Address_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AddressesService {
    /**
     * Create Item
     * @param requestBody
     * @returns Address_Output Successful Response
     * @throws ApiError
     */
    public static createItemAddressesPost(
        requestBody: Address_Input,
    ): CancelablePromise<Address_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/addresses',
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
     * @returns Address_Output Successful Response
     * @throws ApiError
     */
    public static listItemsAddressesGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<Address_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/addresses',
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
     * @returns Address_Output Successful Response
     * @throws ApiError
     */
    public static getItemAddressesItemIdGet(
        itemId: string,
    ): CancelablePromise<Address_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/addresses/{item_id}',
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
     * @returns Address_Output Successful Response
     * @throws ApiError
     */
    public static updateItemAddressesItemIdPut(
        itemId: string,
        requestBody: Address_Input,
    ): CancelablePromise<Address_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/addresses/{item_id}',
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
     * @returns Address_Output Successful Response
     * @throws ApiError
     */
    public static patchItemAddressesItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<Address_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/addresses/{item_id}',
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
    public static deleteItemAddressesItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/addresses/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
