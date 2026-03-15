/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CalendarEvent = {
    id: string;
    entity: string;
    entity_id: string;
    title: string;
    type: string;
    start: string;
    end?: (string | null);
};


export const CalendarEventRequired = ["id","entity","entity_id","title","type","start"] as const;
