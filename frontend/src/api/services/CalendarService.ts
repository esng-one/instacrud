/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CalendarEvent } from '../models/CalendarEvent';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CalendarService {
    /**
     * Get Calendar Events
     * @returns CalendarEvent Successful Response
     * @throws ApiError
     */
    public static getCalendarEventsCalendarGet(): CancelablePromise<Array<CalendarEvent>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/calendar',
        });
    }
}
