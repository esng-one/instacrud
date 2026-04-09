/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MeUsageInfo = {
    used: number;
    limit: (number | null);
    percentage: number;
    remaining: (number | null);
    reset_at: string;
};


export const MeUsageInfoRequired = ["used","percentage","reset_at"] as const;
