//components/entity/tier/TierEditView.tsx

import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import type { Tier_Input as Tier } from "@/api/models/Tier_Input";

interface TierEditViewProps {
  item: Tier;
  onSubmit: (updatedItem: Tier) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function TierEditView({
  item,
  onSubmit,
  onCancel,
  mode,
}: TierEditViewProps) {

  // Form fields for Tier editing
  const formFields: {
    label: string;
    field: keyof Tier;
    type: "text" | "select" | "number" | "checkbox";
    options?: string[];
    required?: boolean;
    render?: (value: string | number | boolean) => React.ReactNode;
  }[] = [
    {
      label: "Tier",
      field: "tier",
      type: "number",
      required: true
    },
    {
      label: "Name",
      field: "name",
      type: "text",
      required: true
    },
    {
      label: "Code",
      field: "code",
      type: "text",
      required: true
    },
    {
      label: "Description",
      field: "description",
      type: "text"
    },
    {
      label: "Usage Limit (leave empty for unlimited)",
      field: "usage",
      type: "number"
    },
    {
      label: "Cost",
      field: "cost",
      type: "number"
    },
    {
      label: "Active",
      field: "active",
      type: "checkbox"
    },
  ];

  return (
    <EntityEditView<Tier>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Tier"
    />
  );
}
