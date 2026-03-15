/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MessageRole } from './MessageRole';
export type ConversationMessage = {
    role: MessageRole;
    content: string;
    image_data?: (string | null);
    image_url?: (string | null);
    generated_images?: (Array<string> | null);
    reasoning_content?: (string | null);
    timestamp?: string;
};


export const ConversationMessageRequired = ["role","content"] as const;
