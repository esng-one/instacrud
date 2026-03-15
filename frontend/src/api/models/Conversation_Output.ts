/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConversationMessage } from './ConversationMessage';
import type { PydanticObjectId } from './PydanticObjectId';
export type Conversation_Output = {
    /**
     * MongoDB document ObjectID
     */
    _id?: (PydanticObjectId | null);
    created_at?: string;
    created_by?: (string | null);
    updated_at?: string;
    updated_by?: (string | null);
    user_id: PydanticObjectId;
    external_uuid?: string;
    title?: (string | null);
    messages?: Array<ConversationMessage>;
    model_id?: (PydanticObjectId | null);
    last_message_at?: string;
};


export const Conversation_OutputRequired = ["user_id"] as const;
