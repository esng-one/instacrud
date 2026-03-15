/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Contact_Input } from '../models/Contact_Input';
import type { Contact_Output } from '../models/Contact_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ContactsService {
    /**
     * Create Item
     * @param requestBody
     * @returns Contact_Output Successful Response
     * @throws ApiError
     */
    public static createItemContactsPost(
        requestBody: Contact_Input,
    ): CancelablePromise<Contact_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/contacts',
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
     * @returns Contact_Output Successful Response
     * @throws ApiError
     */
    public static listItemsContactsGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<Contact_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/contacts',
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
     * @returns Contact_Output Successful Response
     * @throws ApiError
     */
    public static getItemContactsItemIdGet(
        itemId: string,
    ): CancelablePromise<Contact_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/contacts/{item_id}',
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
     * @returns Contact_Output Successful Response
     * @throws ApiError
     */
    public static updateItemContactsItemIdPut(
        itemId: string,
        requestBody: Contact_Input,
    ): CancelablePromise<Contact_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/contacts/{item_id}',
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
     * @returns Contact_Output Successful Response
     * @throws ApiError
     */
    public static patchItemContactsItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<Contact_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/contacts/{item_id}',
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
    public static deleteItemContactsItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/contacts/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
