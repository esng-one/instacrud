//components/entity/organization/OrganizationEditView.tsx

import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import type { OrganizationResponse } from "@/api/models/OrganizationResponse";
import type { OrganizationCreate } from "@/api/models/OrganizationCreate";
import type { Tier_Input as Tier } from "@/api/models/Tier_Input";
import { useTierReferenceField } from "@/hooks/useTierReferenceField";
import useUserRole from "@/hooks/useUserRole";

// For editing, we'll use a combination type that works with both create and update
type OrganizationFormData = OrganizationResponse | OrganizationCreate;

interface OrganizationEditViewProps {
  item: OrganizationFormData;
  onSubmit: (updatedItem: OrganizationFormData) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function OrganizationEditView({
  item,
  onSubmit,
  onCancel,
  mode,
}: OrganizationEditViewProps) {
  const { options: tierOptions, loading: loadingTiers } = useTierReferenceField();
  const { isAdmin } = useUserRole();

  const formFields: {
    label: string;
    field: keyof OrganizationFormData;
    type: "text" | "reference" | "select";
    required?: boolean;
    options?: typeof tierOptions | string[];
    render?: (val: string | number | boolean) => React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
  }[] = [
    { label: "Name", field: "name", type: "text", required: true },
    { label: "Organization Code", field: "code", type: "text", required: true },
    { label: "Description", field: "description", type: "text" },
    {
      label: "Tier",
      field: "tier_id",
      type: "reference",
      options: tierOptions,
      loading: loadingTiers,
      disabled: !isAdmin,
    },
    {
      label: "AI Assistant Conversation Sync",
      field: "local_only_conversations" as keyof OrganizationFormData,
      type: "select",
      options: ["true", "false"],
      render: (val) => val === "true" || val === true ? "Local only" : "Synced with the server",
    },
  ];

  return (
    <EntityEditView<OrganizationFormData, Tier>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Organization"
    />
  );
}
