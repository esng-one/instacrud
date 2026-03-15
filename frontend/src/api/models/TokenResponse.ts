/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
};


export const TokenResponseRequired = ["access_token","token_type","expires_in"] as const;
