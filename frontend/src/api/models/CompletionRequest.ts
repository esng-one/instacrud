/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for text completion.
 */
export type CompletionRequest = {
    /**
     * The prompt for completion
     */
    prompt: string;
    /**
     * AI model ID to use
     */
    model_id: string;
    /**
     * Enable streaming response
     */
    stream?: boolean;
    /**
     * Enable reasoning/chain-of-thought mode
     */
    reasoning?: boolean;
};


export const CompletionRequestRequired = ["prompt","model_id"] as const;
