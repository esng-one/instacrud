/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OAuthLinkRequest = {
    link_code: string;
    current_password: string;
};


export const OAuthLinkRequestRequired = ["link_code","current_password"] as const;
