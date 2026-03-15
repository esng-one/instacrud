//components/entity/organization/OrganizationDetailView.tsx

import React, { useEffect, useMemo, useState } from "react";
import { DetailField, EntityDetailView } from "@/components/entity/EntityDetailView";
import type { OrganizationResponse } from "@/api/models/OrganizationResponse";
import { useTierReferenceField } from "@/hooks/useTierReferenceField";
import { CircularProgress } from "@mui/material";
import Link from "next/link";
import { AiService } from "@/api/services/AiService";

interface OrganizationDetailViewProps {
  item: OrganizationResponse;
  onEdit: () => void;
  detailExtras?: (item: OrganizationResponse) => React.ReactNode;
}

export default function OrganizationDetailView({
  item,
  onEdit,
  detailExtras,
}: OrganizationDetailViewProps) {
  const { options: tierOptions, loading: loadingTiers } = useTierReferenceField();
  const [usage, setUsage] = useState<{ used: number; resetAt: string } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (item.id) {
      setLoadingUsage(true);
      AiService.getOrganizationUsageStatsUsageStatsOrganizationIdGet(item.id)
        .then((data) => {
          setUsage({
            used: (data.usage?.used ?? 0) * 10000,
            resetAt: data.reset_at,
          });
        })
        .catch(() => {
          setUsage(null);
        })
        .finally(() => {
          setLoadingUsage(false);
        });
    }
  }, [item.id]);

  const detailFields: DetailField<OrganizationResponse>[] = useMemo(() => [
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
            <Link
              href={`/tiers?id=${value}`}
              className="text-blue-600 dark:text-blue-400 underline"
            >
              {tierOptions.find((opt) => opt.value === String(value))?.label ?? String(value)}
            </Link>
          )
        ) : (
          <span className="text-gray-400">No tier</span>
        ),
    },
    {
      label: "AI Assistant Conversation Sync",
      field: "local_only_conversations",
      render: (value: unknown) => value ? "Local only" : "Synced with the server",
    },
    { label: "Organization ID", field: "id" },
    {
      label: "Usage",
      field: "usage" as keyof OrganizationResponse,
      render: (_value: unknown) =>
        loadingUsage ? (
          <CircularProgress color="inherit" size={14} />
        ) : usage !== null ? (
          `${Math.round(usage.used)} (resets at ${new Date(usage.resetAt).toLocaleString()})`
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ], [tierOptions, loadingTiers, usage, loadingUsage]);

  return (
    <EntityDetailView<OrganizationResponse>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      detailExtras={detailExtras}
      modelName="Organization"
    />
  );
}
