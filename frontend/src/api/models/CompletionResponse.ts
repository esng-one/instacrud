/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Response for text completion.
 */
export type CompletionResponse = {
    /**
     * Generated completion text
     */
    content: string;
    /**
     * Model used for generation
     */
    model_id: string;
    /**
     * Chain of thought content (if reasoning was enabled)
     */
    reasoning_content?: (string | null);
};


export const CompletionResponseRequired = ["content","model_id"] as const;
