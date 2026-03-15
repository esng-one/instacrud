/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Response for embeddings.
 */
export type EmbeddingResponse = {
    /**
     * Generated embeddings
     */
    embeddings: (Array<Array<number>> | Array<number>);
    /**
     * Model used for generation
     */
    model_id: string;
};


export const EmbeddingResponseRequired = ["embeddings","model_id"] as const;
