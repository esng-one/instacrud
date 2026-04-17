/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Request for chat completion with optional system prompt and function calling.
 */
export type ChatRequest = {
    /**
     * The prompt for completion (may include conversation history)
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
    /**
     * System prompt template with optional $PATH/$CONTEXT bindings
     */
    system_prompt?: (string | null);
    /**
     * Value substituted for $PATH in system_prompt
     */
    path?: (string | null);
    /**
     * Value substituted for $CONTEXT in system_prompt
     */
    context?: (string | null);
    /**
     * Tool set to enable: null = none, '*' = all registered tools
     */
    tools?: (string | null);
};


export const ChatRequestRequired = ["prompt","model_id"] as const;
