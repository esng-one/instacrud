// components/entity/organization/MeOrganizationDetailView.tsx
import { useMemo } from "react";
import { CircularProgress } from "@mui/material";
import { DetailField, EntityDetailView } from "@/components/entity/EntityDetailView";
import type { MeOrganizationResponse } from "@/api/models/MeOrganizationResponse";
import { useTierReferenceField } from "@/hooks/useTierReferenceField";

interface MeOrganizationDetailViewProps {
  item: MeOrganizationResponse;
  onEdit: () => void;
}

export default function MeOrganizationDetailView({ item, onEdit }: MeOrganizationDetailViewProps) {
  const { options: tierOptions, loading: loadingTiers } = useTierReferenceField();

  const detailFields: DetailField<MeOrganizationResponse>[] = useMemo(() => [
    { label: "Name", field: "name" },
    { label: "Organization Code", field: "code" },
    { label: "Description", field: "description" },
    {
      label: "Tier",
      field: "tier_id",
      render: (value: unknown) =>
        value ? (
          loadingTiers ? (
            <CircularProgress color="inherit" size={14} />
          ) : (
            tierOptions.find((opt) => opt.value === String(value))?.label ?? String(value)
          )
        ) : (
          <span className="text-gray-400">No tier</span>
        ),
    },
    {
      label: "AI Assistant Conversation Sync",
      field: "local_only_conversations",
      render: (value: unknown) => (value ? "Local only" : "Synced with the server"),
    },
  ], [tierOptions, loadingTiers]);

  return (
    <EntityDetailView<MeOrganizationResponse>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      modelName="Organization"
    />
  );
}
