/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Client_Input } from '../models/Client_Input';
import type { Client_Output } from '../models/Client_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ClientsService {
    /**
     * Create Item
     * @param requestBody
     * @returns Client_Output Successful Response
     * @throws ApiError
     */
    public static createItemClientsPost(
        requestBody: Client_Input,
    ): CancelablePromise<Client_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/clients',
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
     * @returns Client_Output Successful Response
     * @throws ApiError
     */
    public static listItemsClientsGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<Client_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/clients',
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
     * @returns Client_Output Successful Response
     * @throws ApiError
     */
    public static getItemClientsItemIdGet(
        itemId: string,
    ): CancelablePromise<Client_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/clients/{item_id}',
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
     * @returns Client_Output Successful Response
     * @throws ApiError
     */
    public static updateItemClientsItemIdPut(
        itemId: string,
        requestBody: Client_Input,
    ): CancelablePromise<Client_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/clients/{item_id}',
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
     * @returns Client_Output Successful Response
     * @throws ApiError
     */
    public static patchItemClientsItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<Client_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/clients/{item_id}',
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
    public static deleteItemClientsItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/clients/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
