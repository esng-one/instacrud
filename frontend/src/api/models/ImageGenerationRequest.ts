/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for image generation.
 */
export type ImageGenerationRequest = {
    /**
     * Text description of the image
     */
    prompt: string;
    /**
     * AI model ID to use
     */
    model_id: string;
    /**
     * Image size (e.g., '1024x1024', '512x512')
     */
    size?: string;
    /**
     * Image quality (e.g., 'standard', 'hd')
     */
    quality?: string;
    /**
     * Number of images to generate
     */
    'n'?: number;
    /**
     * Response format
     */
    response_format?: ImageGenerationRequest.response_format;
    /**
     * Base64 encoded reference image for image-to-image generation
     */
    image_data?: (string | null);
};
export namespace ImageGenerationRequest {
    /**
     * Response format
     */
    export enum response_format {
        URL = 'url',
        B64_JSON = 'b64_json',
    }
}


export const ImageGenerationRequestRequired = ["prompt","model_id"] as const;
