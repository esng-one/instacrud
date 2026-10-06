/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MeOrganizationResponse } from '../models/MeOrganizationResponse';
import type { MeOrganizationUpdate } from '../models/MeOrganizationUpdate';
import type { MeResponse } from '../models/MeResponse';
import type { MeUpdateRequest } from '../models/MeUpdateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class MeService {
    /**
     * Get Me
     * Return the full profile of the currently authenticated user.
     * @returns MeResponse Successful Response
     * @throws ApiError
     */
    public static getMeMeGet(): CancelablePromise<MeResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/me',
        });
    }
    /**
     * Patch Me
     * Update the currently authenticated user.
     * @param requestBody
     * @returns MeResponse Successful Response
     * @throws ApiError
     */
    public static patchMeMePatch(
        requestBody: MeUpdateRequest,
    ): CancelablePromise<MeResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/me',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Me Organization
     * Return the organization of the currently authenticated ORG_ADMIN user.
     * @returns MeOrganizationResponse Successful Response
     * @throws ApiError
     */
    public static getMeOrganizationMeOrganizationGet(): CancelablePromise<MeOrganizationResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/me/organization',
        });
    }
    /**
     * Patch Me Organization
     * Update allowed organization fields for ORG_ADMIN.
     *
     * Omitting a field leaves it unchanged. Sending description as null or "" clears it.
     * @param requestBody
     * @returns MeOrganizationResponse Successful Response
     * @throws ApiError
     */
    public static patchMeOrganizationMeOrganizationPatch(
        requestBody: MeOrganizationUpdate,
    ): CancelablePromise<MeOrganizationResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/me/organization',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Retry Provisioning
     * Resume a stuck organization provisioning.
     *
     * The provisioning task is a fire-and-forget background job; if its worker is
     * killed or CPU-throttled mid-run (common on serverless once the response is sent)
     * the org is stranded in PROVISIONING. The provisioning guard calls this to recover.
     *
     * It re-dispatches an idempotent provisioning attempt, but only once the current
     * attempt looks stalled (``PROVISIONING_STALE_SECONDS``), so a healthy in-flight
     * provision is never interrupted. FAILED orgs are always retried.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static retryProvisioningMeOrganizationRetryProvisioningPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/me/organization/retry-provisioning',
        });
    }
}
