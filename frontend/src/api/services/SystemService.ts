/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePasswordRequest } from '../models/ChangePasswordRequest';
import type { ForgotPasswordRequest } from '../models/ForgotPasswordRequest';
import type { MessageResponse } from '../models/MessageResponse';
import type { ResetPasswordRequest } from '../models/ResetPasswordRequest';
import type { SignInRequest } from '../models/SignInRequest';
import type { SignupResponse } from '../models/SignupResponse';
import type { TokenResponse } from '../models/TokenResponse';
import type { UserCreate } from '../models/UserCreate';
import type { UserSettingsResponse } from '../models/UserSettingsResponse';
import type { UserSettingsUpdate } from '../models/UserSettingsUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class SystemService {
    /**
     * Forgot Password
     * Request password reset email
     * @param requestBody
     * @param cfTurnstileToken
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static forgotPasswordForgotPasswordPost(
        requestBody: ForgotPasswordRequest,
        cfTurnstileToken?: (string | null),
    ): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/forgotPassword',
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
     * Reset Password
     * Reset password using token
     * @param requestBody
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static resetPasswordResetPasswordPost(
        requestBody: ResetPasswordRequest,
    ): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/resetPassword',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Change Password
     * Change password for authenticated user
     * @param requestBody
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static changePasswordChangePasswordPost(
        requestBody: ChangePasswordRequest,
    ): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/changePassword',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Signup
     * @param requestBody
     * @param organizationName
     * @param loadMockData
     * @param cfTurnstileToken
     * @returns SignupResponse Successful Response
     * @throws ApiError
     */
    public static signupSignupPost(
        requestBody: UserCreate,
        organizationName?: (string | null),
        loadMockData?: (boolean | null),
        cfTurnstileToken?: (string | null),
    ): CancelablePromise<SignupResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/signup',
            headers: {
                'CF-Turnstile-Token': cfTurnstileToken,
            },
            query: {
                'organization_name': organizationName,
                'load_mock_data': loadMockData,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Signin
     * @param requestBody
     * @param cfTurnstileToken
     * @returns TokenResponse Successful Response
     * @throws ApiError
     */
    public static signinSigninPost(
        requestBody: SignInRequest,
        cfTurnstileToken?: (string | null),
    ): CancelablePromise<TokenResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/signin',
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
     * Heartbeat
     * @returns MessageResponse Successful Response
     * @throws ApiError
     */
    public static heartbeatHeartbeatGet(): CancelablePromise<MessageResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/heartbeat',
        });
    }
    /**
     * Get Settings
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getSettingsGetSettingsGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/getSettings',
        });
    }
    /**
     * Get User Settings
     * Get current user's sync settings with effective values.
     * @returns UserSettingsResponse Successful Response
     * @throws ApiError
     */
    public static getUserSettingsUserSettingsGet(): CancelablePromise<UserSettingsResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/user-settings',
        });
    }
    /**
     * Update User Settings
     * Update current user's sync settings.
     * @param requestBody
     * @returns UserSettingsResponse Successful Response
     * @throws ApiError
     */
    public static updateUserSettingsUserSettingsPatch(
        requestBody: UserSettingsUpdate,
    ): CancelablePromise<UserSettingsResponse> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/user-settings',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
