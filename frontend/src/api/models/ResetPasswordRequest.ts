/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ResetPasswordRequest = {
    token: string;
    new_password: string;
};


export const ResetPasswordRequestRequired = ["token","new_password"] as const;
