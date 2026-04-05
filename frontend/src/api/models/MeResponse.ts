/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MeOrgInfo } from './MeOrgInfo';
import type { MeTierInfo } from './MeTierInfo';
import type { MeUsageInfo } from './MeUsageInfo';
import type { MeUserInfo } from './MeUserInfo';
export type MeResponse = {
    user: MeUserInfo;
    organization: (MeOrgInfo | null);
    usage: MeUsageInfo;
    tier: (MeTierInfo | null);
};


export const MeResponseRequired = ["user","usage"] as const;
