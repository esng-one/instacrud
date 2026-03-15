/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Role } from './Role';
export type InviteUserCreate = {
    email: string;
    role?: Role;
    organization_id?: (string | null);
    expires_in_seconds?: number;
};


export const InviteUserCreateRequired = ["email"] as const;
