/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Project_Output } from '../models/Project_Output';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * Get Projects Period
     * @param start
     * @param end
     * @param skip
     * @param limit
     * @returns Project_Output Successful Response
     * @throws ApiError
     */
    public static getProjectsPeriodProjectsPeriodGet(
        start: string,
        end: string,
        skip?: number,
        limit: number = 10,
    ): CancelablePromise<Array<Project_Output>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/projects/period',
            query: {
                'start': start,
                'end': end,
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
