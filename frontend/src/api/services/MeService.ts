/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
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
     * Update allowed fields (name, email) of the currently authenticated user.
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
}
