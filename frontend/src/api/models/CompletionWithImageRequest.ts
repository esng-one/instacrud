/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for completion with image input.
 */
export type CompletionWithImageRequest = {
    /**
     * Text prompt
     */
    prompt: string;
    /**
     * AI model ID to use
     */
    model_id: string;
    /**
     * URL of the image
     */
    image_url?: (string | null);
    /**
     * Base64 encoded image data
     */
    image_data?: (string | null);
    /**
     * MIME type (e.g., 'image/jpeg')
     */
    image_media_type?: (string | null);
    /**
     * Detail level: 'low', 'high', or 'auto'
     */
    image_detail?: string;
    /**
     * Enable streaming response
     */
    stream?: boolean;
    /**
     * Enable reasoning/chain-of-thought mode
     */
    reasoning?: boolean;
};


export const CompletionWithImageRequestRequired = ["prompt","model_id"] as const;
