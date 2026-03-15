//components/entity/organization/OrganizationGrid.tsx

"use client";
import { useEffect, useState } from "react";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { OrganizationResponse } from "@/api/models/OrganizationResponse";
import { useTierReferenceField } from "@/hooks/useTierReferenceField";
import { CircularProgress } from "@mui/material";
import { AiService } from "@/api/services/AiService";

interface OrganizationGridProps {
  rows: OrganizationResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: OrganizationResponse) => void;
}

export default function OrganizationGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: OrganizationGridProps) {
  const { options: tierOptions, loading: loadingTiers } = useTierReferenceField();
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    const orgIds = rows.map((r) => r.id).filter(Boolean);
    if (orgIds.length === 0) return;
    setLoadingUsage(true);
    AiService.getBulkOrganizationUsageStatsUsageStatsBulkPost(orgIds)
      .then((data) => setUsageMap(data))
      .catch(() => setUsageMap({}))
      .finally(() => setLoadingUsage(false));
  }, [rows]);

  const organizationColumns: GridColDef[] = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 200 },
    { field: "code", headerName: "Organization Code", flex: 1, minWidth: 150 },
    { field: "description", headerName: "Description", flex: 1.5, minWidth: 200 },
    {
      field: "tier_id",
      headerName: "Tier",
      flex: 0.5,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams) => {
        if (!params.value) return <span className="text-gray-400">-</span>;
        if (loadingTiers) return <CircularProgress color="inherit" size={14} />;
        const tier = tierOptions.find((opt) => opt.value === String(params.value));
        return tier?.label ?? params.value;
      }
    },
    {
      field: "usage",
      headerName: "Usage",
      flex: 0.5,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams) => {
        if (loadingUsage) return <CircularProgress color="inherit" size={14} />;
        const usage = usageMap[params.row.id] ?? 0;
        return (usage * 10000).toLocaleString();
      }
    },
  ];

  return (
    <EntityGrid<OrganizationResponse>
      rows={rows}
      columns={organizationColumns}
      idKey="id"
      page={page}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      onDelete={onDelete}
    />
  );
}
