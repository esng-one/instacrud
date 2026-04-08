//components/entity/tier/TierDetailView.tsx

import React from "react";
import { EntityDetailView } from "@/components/entity/EntityDetailView";
import { formatDateTime } from "@/app/lib/util";
import type { Tier_Input as Tier } from "@/api/models/Tier_Input";

export const detailFields: {
  label: string;
  field: keyof Tier;
  render?: (value: any) => React.ReactNode;
}[] = [
  { label: "Tier", field: "tier" },
  { label: "Name", field: "name" },
  { label: "Code", field: "code" },
  { label: "Description", field: "description", render: (value: string | null) => value || "-" },
  {
    label: "Usage Limit",
    field: "usage",
    render: (value: number | null) => value !== null ? value.toLocaleString() : "Unlimited"
  },
  {
    label: "Cost",
    field: "cost",
    render: (value: number | null) => value !== null ? `$${value.toFixed(2)}` : "-"
  },
  {
    label: "Active",
    field: "active",
    render: (value: boolean) => value ? "Yes" : "No"
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

interface TierDetailViewProps {
  item: Tier;
  onEdit?: () => void;
  onDelete?: () => void;
  detailExtras?: (item: Tier) => React.ReactNode;
}

export default function TierDetailView({
  item,
  onEdit,
  onDelete,
  detailExtras,
}: TierDetailViewProps) {
  return (
    <EntityDetailView<Tier>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      onRemove={onDelete}
      detailExtras={detailExtras}
      modelName="Tier"
    />
  );
}
