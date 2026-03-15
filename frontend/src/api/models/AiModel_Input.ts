/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AiServiceProvider } from './AiServiceProvider';
import type { PydanticObjectId } from './PydanticObjectId';
export type AiModel_Input = {
    /**
     * MongoDB document ObjectID
     */
    _id?: (PydanticObjectId | null);
    created_at?: string;
    created_by?: (string | null);
    updated_at?: string;
    updated_by?: (string | null);
    service: AiServiceProvider;
    name: string;
    model_identifier: string;
    temperature?: (number | null);
    max_tokens?: (number | null);
    credits?: (number | null);
    input_tokens_cost?: (number | null);
    output_tokens_cost?: (number | null);
    completion?: boolean;
    embedding?: boolean;
    image_completion?: boolean;
    image_generation?: boolean;
    reasoning?: boolean;
    enabled?: boolean;
    rank?: (number | null);
    params?: (Record<string, any> | null);
    tier?: (number | null);
    icon?: (string | null);
};


export const AiModel_InputRequired = ["service","name","model_identifier"] as const;
