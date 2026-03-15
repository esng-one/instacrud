/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for generating embeddings.
 */
export type EmbeddingRequest = {
    /**
     * Text(s) to generate embeddings for
     */
    text: (Array<string> | string);
    /**
     * AI model ID to use
     */
    model_id: string;
};


export const EmbeddingRequestRequired = ["text","model_id"] as const;
