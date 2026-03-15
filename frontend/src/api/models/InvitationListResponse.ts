/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Role } from './Role';
export type InvitationListResponse = {
    id: string;
    organization_id: string;
    invited_by: string;
    invited_at: string;
    expires_at: string;
    role: Role;
    accepted: boolean;
};


export const InvitationListResponseRequired = ["id","organization_id","invited_by","invited_at","expires_at","role","accepted"] as const;
