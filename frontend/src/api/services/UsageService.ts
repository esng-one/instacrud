/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsageService {
    /**
     * Get Usage Stats
     * Get current usage statistics for the authenticated user.
     *
     * Returns usage for all AI service types (completions, embeddings, images, medias)
     * along with tier limits and reset time.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getUsageStatsUsageStatsGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/usage/stats',
        });
    }
    /**
     * Get Organization Usage Stats
     * Get usage statistics for an organization.
     *
     * ADMIN can query any organization by ID.
     * ORG_ADMIN gets their own organization's stats (organization_id parameter is ignored).
     * @param organizationId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getOrganizationUsageStatsUsageStatsOrganizationIdGet(
        organizationId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/usage/stats/{organization_id}',
            path: {
                'organization_id': organizationId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Bulk Organization Usage Stats
     * Get usage values for multiple organizations (admin only).
     * Returns a map of organization_id -> usage (number, 0 if none).
     * @param requestBody
     * @returns number Successful Response
     * @throws ApiError
     */
    public static getBulkOrganizationUsageStatsUsageStatsBulkPost(
        requestBody: Array<string>,
    ): CancelablePromise<Record<string, number>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/usage/stats/bulk',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
