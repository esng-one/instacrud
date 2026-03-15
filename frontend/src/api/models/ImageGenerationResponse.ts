/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Response for image generation.
 */
export type ImageGenerationResponse = {
    /**
     * Generated image URLs or base64 data
     */
    images: Array<string>;
    /**
     * Model used for generation
     */
    model_id: string;
    /**
     * Response format (url or b64_json)
     */
    format: string;
};


export const ImageGenerationResponseRequired = ["images","model_id","format"] as const;
