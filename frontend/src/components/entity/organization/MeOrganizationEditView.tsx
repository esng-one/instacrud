// components/entity/organization/MeOrganizationEditView.tsx
import { EntityEditView, EditField } from "@/components/entity/EntityEditView";
import type { MeOrganizationResponse } from "@/api/models/MeOrganizationResponse";
import type { Tier_Input as Tier } from "@/api/models/Tier_Input";
import { useTierReferenceField } from "@/hooks/useTierReferenceField";

interface MeOrganizationEditViewProps {
  item: MeOrganizationResponse;
  onSubmit: (updated: MeOrganizationResponse) => void;
  onCancel: () => void;
}

export default function MeOrganizationEditView({
  item,
  onSubmit,
  onCancel,
}: MeOrganizationEditViewProps) {
  const { options: tierOptions, loading: loadingTiers } = useTierReferenceField();

  const formFields: EditField<MeOrganizationResponse, Tier>[] = [
    { label: "Name", field: "name", type: "text", required: true },
    { label: "Organization Code", field: "code", type: "text", disabled: true },
    { label: "Description", field: "description", type: "textarea" },
    {
      label: "Tier",
      field: "tier_id",
      type: "reference",
      options: tierOptions,
      loading: loadingTiers,
      disabled: true,
    },
    {
      label: "AI Assistant Conversation Sync",
      field: "local_only_conversations",
      type: "select",
      options: ["true", "false"],
      render: (val) => val === "true" || val === true ? "Local only" : "Synced with the server",
    },
  ];

  return (
    <EntityEditView<MeOrganizationResponse, Tier>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode="edit"
      modelName="Organization"
    />
  );
}
