//components/entity/aimodel/AiModelDetailView.tsx

import React from "react";
import { EntityDetailView } from "@/components/entity/EntityDetailView";
import { formatEnum, formatDateTime } from "@/app/lib/util";
import type { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";

export const detailFields: {
  label: string;
  field: keyof AiModel;
  render?: (value: any) => React.ReactNode;
}[] = [
  { label: "Name", field: "name" },
  {
    label: "Service Provider",
    field: "service",
    render: (value: string) => formatEnum(value)
  },
  { label: "Model Identifier", field: "model_identifier" },
  { label: "Temperature", field: "temperature" },
  { label: "Max Tokens", field: "max_tokens" },
  {
    label: "Credits",
    field: "credits",
    render: (value: number | null) => value ?? "-"
  },
  {
    label: "Input Tokens Cost",
    field: "input_tokens_cost",
    render: (value: number | null) => value ?? "-"
  },
  {
    label: "Output Tokens Cost",
    field: "output_tokens_cost",
    render: (value: number | null) => value ?? "-"
  },
  {
    label: "Completion Support",
    field: "completion",
    render: (value: boolean) => value ? "Yes" : "No"
  },
  {
    label: "Embedding Support",
    field: "embedding",
    render: (value: boolean) => value ? "Yes" : "No"
  },
  {
    label: "Image Completion Support",
    field: "image_completion",
    render: (value: boolean) => value ? "Yes" : "No"
  },
  {
    label: "Image Generation Support",
    field: "image_generation",
    render: (value: boolean) => value ? "Yes" : "No"
  },
  {
    label: "Enabled",
    field: "enabled",
    render: (value: boolean) => value ? "Yes" : "No"
  },
  {
    label: "Rank",
    field: "rank",
    render: (value: number | null) => value ?? "-"
  },
  {
    label: "Tier",
    field: "tier",
    render: (value: number | null) => value ?? "-"
  },
  {
    label: "Created At",
    field: "created_at",
    render: (value: string) => formatDateTime(value) || "-"
  },
  {
    label: "Created By",
    field: "created_by",
    render: (value: string | null) => value || "-"
  },
  {
    label: "Updated At",
    field: "updated_at",
    render: (value: string) => formatDateTime(value) || "-"
  },
  {
    label: "Updated By",
    field: "updated_by",
    render: (value: string | null) => value || "-"
  },
];

interface AiModelDetailViewProps {
  item: AiModel;
  onEdit?: () => void;
  onDelete?: () => void;
  detailExtras?: (item: AiModel) => React.ReactNode;
}

export default function AiModelDetailView({
  item,
  onEdit,
  onDelete,
  detailExtras,
}: AiModelDetailViewProps) {
  return (
    <EntityDetailView<AiModel>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      onRemove={onDelete}
      detailExtras={detailExtras}
      modelName="AI Model"
    />
  );
}
