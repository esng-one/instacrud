/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TokenResponse } from '../models/TokenResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OauthService {
    /**
     * Get Session Token
     * @param sessionCode
     * @returns TokenResponse Successful Response
     * @throws ApiError
     */
    public static getSessionTokenSessionGet(
        sessionCode: string,
    ): CancelablePromise<TokenResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/session',
            query: {
                'session_code': sessionCode,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Oauth Login
     * @param provider
     * @returns void
     * @throws ApiError
     */
    public static oauthLoginSigninProviderGet(
        provider: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/signin/{provider}',
            path: {
                'provider': provider,
            },
            errors: {
                307: `Successful Response`,
                422: `Validation Error`,
            },
        });
    }
    /**
     * Oauth Login Callback
     * @param provider
     * @returns TokenResponse Successful Response
     * @throws ApiError
     */
    public static oauthLoginCallbackSigninProviderCallbackGet(
        provider: string,
    ): CancelablePromise<TokenResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/signin/{provider}/callback',
            path: {
                'provider': provider,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Oauth Signup
     * @param provider
     * @param state
     * @returns any Successful Response
     * @throws ApiError
     */
    public static oauthSignupSignupProviderGet(
        provider: string,
        state?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/signup/{provider}',
            path: {
                'provider': provider,
            },
            query: {
                'state': state,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Oauth Signup Callback
     * @param provider
     * @returns TokenResponse Successful Response
     * @throws ApiError
     */
    public static oauthSignupCallbackSignupProviderCallbackGet(
        provider: string,
    ): CancelablePromise<TokenResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/signup/{provider}/callback',
            path: {
                'provider': provider,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
