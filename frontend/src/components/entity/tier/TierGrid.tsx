//components/entity/tier/TierGrid.tsx

"use client";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { Tier_Input as Tier } from "@/api/models/Tier_Input";

interface TierGridProps {
  rows: Tier[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: Tier) => void;
}

export default function TierGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: TierGridProps) {

  const tierColumns: GridColDef[] = [
    {
      field: "tier",
      headerName: "Tier",
      flex: 0.1,
      minWidth: 80
    },
    {
      field: "name",
      headerName: "Name",
      flex: 0.2,
      minWidth: 150
    },
    {
      field: "code",
      headerName: "Code",
      flex: 0.15,
      minWidth: 100
    },
    {
      field: "usage",
      headerName: "Usage Limit",
      flex: 0.15,
      minWidth: 120,
      renderCell: (params: GridRenderCellParams) =>
        params.value !== null && params.value !== undefined
          ? `${(params.value as number).toLocaleString()}`
          : "Unlimited"
    },
    {
      field: "cost",
      headerName: "Cost",
      flex: 0.1,
      minWidth: 80,
      renderCell: (params: GridRenderCellParams) =>
        params.value !== null && params.value !== undefined
          ? `$${(params.value as number).toFixed(2)}`
          : "-"
    },
    {
      field: "active",
      headerName: "Active",
      flex: 0.1,
      minWidth: 80,
      renderCell: (params: GridRenderCellParams) => params.value ? "Yes" : "No"
    },
  ];

  return (
    <EntityGrid<Tier>
      rows={rows}
      columns={tierColumns}
      idKey="_id"
      page={page}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      onDelete={onDelete}
    />
  );
}
