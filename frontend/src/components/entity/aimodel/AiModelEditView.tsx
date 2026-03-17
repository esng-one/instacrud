//components/entity/aimodel/AiModelEditView.tsx

import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import { formatEnum } from "@/app/lib/util";
import type { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";
import { AiServiceProvider } from "@/api/models/AiServiceProvider";

interface AiModelEditViewProps {
  item: AiModel;
  onSubmit: (updatedItem: AiModel) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function AiModelEditView({
  item,
  onSubmit,
  onCancel,
  mode,
}: AiModelEditViewProps) {

  // Form fields for AI Model editing
  const formFields: {
    label: string;
    field: keyof AiModel;
    type: "text" | "select" | "number" | "checkbox";
    options?: string[];
    render?: (value: string | number | boolean) => React.ReactNode;
  }[] = [
    {
      label: "Name",
      field: "name",
      type: "text"
    },
    {
      label: "Service Provider",
      field: "service",
      type: "select",
      options: Object.values(AiServiceProvider),
      render: (value: string | number | boolean) => formatEnum(String(value))
    },
    {
      label: "Model Identifier",
      field: "model_identifier",
      type: "text"
    },
    {
      label: "Temperature",
      field: "temperature",
      type: "number"
    },
    {
      label: "Max Tokens",
      field: "max_tokens",
      type: "number"
    },
    {
      label: "Credits (optional)",
      field: "credits",
      type: "number"
    },
    {
      label: "Input Tokens Cost (optional)",
      field: "input_tokens_cost",
      type: "number"
    },
    {
      label: "Output Tokens Cost (optional)",
      field: "output_tokens_cost",
      type: "number"
    },
    {
      label: "Completion Support",
      field: "completion",
      type: "checkbox"
    },
    {
      label: "Embedding Support",
      field: "embedding",
      type: "checkbox"
    },
    {
      label: "Image Completion Support",
      field: "image_completion",
      type: "checkbox"
    },
    {
      label: "Image Generation Support",
      field: "image_generation",
      type: "checkbox"
    },
    {
      label: "Enabled",
      field: "enabled",
      type: "checkbox"
    },
    {
      label: "Rank",
      field: "rank",
      type: "number"
    },
    {
      label: "Tier",
      field: "tier",
      type: "number"
    },
  ];

  return (
    <EntityEditView<AiModel>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="AI Model"
    />
  );
}
