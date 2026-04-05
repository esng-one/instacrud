/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MeUserInfo = {
    id: string;
    email: string;
    name: (string | null);
    role: string;
    has_password: boolean;
};


export const MeUserInfoRequired = ["id","email","role","has_password"] as const;
