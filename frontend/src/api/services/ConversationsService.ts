/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Conversation_Input } from '../models/Conversation_Input';
import type { Conversation_Output } from '../models/Conversation_Output';
import type { ConversationCreate } from '../models/ConversationCreate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ConversationsService {
    /**
     * List Conversations
     * @param skip
     * @param limit
     * @param filters
     * @returns Conversation_Output Successful Response
     * @throws ApiError
     */
    public static listConversationsConversationsGet(
        skip?: number,
        limit: number = 10,
        filters?: (string | null),
    ): CancelablePromise<Array<Conversation_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/conversations',
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
     * Create Conversation
     * @param requestBody
     * @returns Conversation_Output Successful Response
     * @throws ApiError
     */
    public static createConversationConversationsPost(
        requestBody: ConversationCreate,
    ): CancelablePromise<Conversation_Output> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/conversations',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Conversation
     * @param itemId
     * @returns Conversation_Output Successful Response
     * @throws ApiError
     */
    public static getConversationConversationsItemIdGet(
        itemId: string,
    ): CancelablePromise<Conversation_Output> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/conversations/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Conversation
     * @param itemId
     * @param requestBody
     * @returns Conversation_Output Successful Response
     * @throws ApiError
     */
    public static updateConversationConversationsItemIdPut(
        itemId: string,
        requestBody: Conversation_Input,
    ): CancelablePromise<Conversation_Output> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/conversations/{item_id}',
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
     * Patch Conversation
     * @param itemId
     * @param requestBody
     * @returns Conversation_Output Successful Response
     * @throws ApiError
     */
    public static patchConversationConversationsItemIdPatch(
        itemId: string,
        requestBody: Record<string, any>,
    ): CancelablePromise<Conversation_Output> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/conversations/{item_id}',
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
     * Delete Conversation
     * @param itemId
     * @returns void
     * @throws ApiError
     */
    public static deleteConversationConversationsItemIdDelete(
        itemId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/conversations/{item_id}',
            path: {
                'item_id': itemId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
