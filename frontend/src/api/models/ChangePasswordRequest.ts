/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChangePasswordRequest = {
    current_password: string;
    new_password: string;
};


export const ChangePasswordRequestRequired = ["current_password","new_password"] as const;
