/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Project_Input } from '../models/Project_Input';
import type { Project_Output } from '../models/Project_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProjectsService {
    /**
     * Create Item
     * @param requestBody
     * @returns Project_Output Successful Response
     * @throws ApiError
     */
    public static createItemProjectsPost(
        requestBody: Project_Input,
    ): CancelablePromise<Project_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/projects',
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
     * @returns Project_Output Successful Response
     * @throws ApiError
     */
    public static listItemsProjectsGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<Project_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/projects',
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
     * @returns Project_Output Successful Response
     * @throws ApiError
     */
    public static getItemProjectsItemIdGet(
        itemId: string,
    ): CancelablePromise<Project_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/projects/{item_id}',
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
     * @returns Project_Output Successful Response
     * @throws ApiError
     */
    public static updateItemProjectsItemIdPut(
        itemId: string,
        requestBody: Project_Input,
    ): CancelablePromise<Project_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/projects/{item_id}',
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
     * @returns Project_Output Successful Response
     * @throws ApiError
     */
    public static patchItemProjectsItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<Project_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/projects/{item_id}',
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
    public static deleteItemProjectsItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/projects/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
