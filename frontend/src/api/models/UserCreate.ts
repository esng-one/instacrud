/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Role } from './Role';
export type UserCreate = {
    email: string;
    password: string;
    name: string;
    role?: Role;
    organization_id?: (string | null);
    invitation_id?: (string | null);
};


export const UserCreateRequired = ["email","password","name"] as const;
