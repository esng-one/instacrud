/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Role } from './Role';
export type UserResponse = {
    id: string;
    email: string;
    name?: (string | null);
    role: Role;
    organization_id?: (string | null);
};


export const UserResponseRequired = ["id","email","role"] as const;
