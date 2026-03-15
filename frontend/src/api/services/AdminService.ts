/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiModel_Input } from '../models/AiModel_Input';
import type { AiModel_Output } from '../models/AiModel_Output';
import type { DeleteOrgConfirmResponse } from '../models/DeleteOrgConfirmResponse';
import type { InvitationListResponse } from '../models/InvitationListResponse';
import type { InvitationResponse } from '../models/InvitationResponse';
import type { InviteUserCreate } from '../models/InviteUserCreate';
import type { MessageResponse } from '../models/MessageResponse';
import type { OrganizationCreate } from '../models/OrganizationCreate';
import type { OrganizationResponse } from '../models/OrganizationResponse';
import type { OrganizationUpdate } from '../models/OrganizationUpdate';
import type { Tier_Input } from '../models/Tier_Input';
import type { Tier_Output } from '../models/Tier_Output';
import type { UserCreate } from '../models/UserCreate';
import type { UserResponse } from '../models/UserResponse';
import type { UserUpdate } from '../models/UserUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminService {
    /**
     * List Organizations
     * @returns OrganizationResponse Successful Response
     * @throws ApiError
     */
    public static listOrganizationsAdminOrganizationsGet(): CancelablePromise<Array<OrganizationResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/organizations',
        });
    }
    /**
     * Onboard Organization
     * @param requestBody
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static onboardOrganizationAdminOrganizationsPost(
        requestBody: OrganizationCreate,
    ): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/organizations',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Organization
     * @param organizationId
     * @returns OrganizationResponse Successful Response
     * @throws ApiError
     */
    public static getOrganizationAdminOrganizationsOrganizationIdGet(
        organizationId: string,
    ): CancelablePromise<OrganizationResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/organizations/{organization_id}',
            path: {
                'organization_id': organizationId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Organization
     * @param organizationId
     * @param requestBody
     * @returns OrganizationResponse Successful Response
     * @throws ApiError
     */
    public static updateOrganizationAdminOrganizationsOrganizationIdPatch(
        organizationId: string,
        requestBody: OrganizationUpdate,
    ): CancelablePromise<OrganizationResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/admin/organizations/{organization_id}',
            path: {
                'organization_id': organizationId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Organization
     * @param organizationId
     * @param confirmHash Hash to confirm deletion
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteOrganizationAdminOrganizationsOrganizationIdDelete(
        organizationId: string,
        confirmHash: string = '',
    ): CancelablePromise<(MessageResponse | DeleteOrgConfirmResponse)> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/admin/organizations/{organization_id}',
            path: {
                'organization_id': organizationId,
            },
            query: {
                'confirm_hash': confirmHash,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Add User
     * @param requestBody
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static addUserAdminAddUserPost(
        requestBody: UserCreate,
    ): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/add_user',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Users
     * @param organizationId
     * @param skip
     * @param limit
     * @returns UserResponse Successful Response
     * @throws ApiError
     */
    public static listUsersAdminUsersGet(
        organizationId?: (string | null),
        skip?: (number | null),
        limit?: (number | null),
    ): CancelablePromise<Array<UserResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/users',
            query: {
                'organization_id': organizationId,
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get User
     * @param userId
     * @returns UserResponse Successful Response
     * @throws ApiError
     */
    public static getUserAdminUsersUserIdGet(
        userId: string,
    ): CancelablePromise<UserResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/users/{user_id}',
            path: {
                'user_id': userId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update User
     * @param userId
     * @param requestBody
     * @returns UserResponse Successful Response
     * @throws ApiError
     */
    public static updateUserAdminUsersUserIdPatch(
        userId: string,
        requestBody: UserUpdate,
    ): CancelablePromise<UserResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/admin/users/{user_id}',
            path: {
                'user_id': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete User
     * @param userId
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static deleteUserAdminUsersUserIdDelete(
        userId: string,
    ): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/admin/users/{user_id}',
            path: {
                'user_id': userId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Invite User
     * @param requestBody
     * @param cfTurnstileToken
     * @returns InvitationResponse Successful Response
     * @throws ApiError
     */
    public static inviteUserAdminInviteUserPost(
        requestBody: InviteUserCreate,
        cfTurnstileToken?: (string | null),
    ): CancelablePromise<InvitationResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/invite_user',
            headers: {
                'CF-Turnstile-Token': cfTurnstileToken,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Invitations
     * @param organizationId
     * @param skip
     * @param limit
     * @returns InvitationListResponse Successful Response
     * @throws ApiError
     */
    public static listInvitationsAdminInvitationsGet(
        organizationId?: (string | null),
        skip?: (number | null),
        limit?: (number | null),
    ): CancelablePromise<Array<InvitationListResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/invitations',
            query: {
                'organization_id': organizationId,
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Invitation
     * @param invitationId
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static deleteInvitationAdminInvitationsInvitationIdDelete(
        invitationId: string,
    ): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/admin/invitations/{invitation_id}',
            path: {
                'invitation_id': invitationId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
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
