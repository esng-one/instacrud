//components/entity/aimodel/AiModelGrid.tsx

"use client";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";
import { formatEnum } from "@/app/lib/util";

interface AiModelGridProps {
  rows: AiModel[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: AiModel) => void;
}

export default function AiModelGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: AiModelGridProps) {

  const aiModelColumns: GridColDef[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 0.15,
      minWidth: 100
    },
    {
      field: "service",
      headerName: "Service",
      flex: 0.15,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams) => formatEnum(params.value ?? "")
    },
    {
      field: "model_identifier",
      headerName: "Model Identifier",
      flex: 0.3,
      minWidth: 175
    },
    {
      field: "temperature",
      headerName: "Temperature",
      flex: 0.1,
      minWidth: 65
    },
    {
      field: "max_tokens",
      headerName: "Max Tokens",
      flex: 0.15,
      minWidth: 95
    },
    {
      field: "completion",
      headerName: "Completion",
      flex: 0.1,
      minWidth: 75,
      renderCell: (params: GridRenderCellParams) => params.value ? "Yes" : "No"
    },
    {
      field: "image_completion",
      headerName: "Image",
      flex: 0.1,
      minWidth: 75,
      renderCell: (params: GridRenderCellParams) => params.value ? "Yes" : "No"
    },
    {
      field: "embedding",
      headerName: "Embedding",
      flex: 0.1,
      minWidth: 75,
      renderCell: (params: GridRenderCellParams) => params.value ? "Yes" : "No"
    },
    {
      field: "credits",
      headerName: "Credits",
      flex: 0.08,
      minWidth: 60
    },
    {
      field: "input_tokens_cost",
      headerName: "Input Cost",
      flex: 0.08,
      minWidth: 60
    },
    {
      field: "output_tokens_cost",
      headerName: "Output Cost",
      flex: 0.08,
      minWidth: 60
    },
    {
      field: "enabled",
      headerName: "Enabled",
      flex: 0.1,
      minWidth: 75,
      renderCell: (params: GridRenderCellParams) => params.value ? "Yes" : "No"
    },
    {
      field: "rank",
      headerName: "Rank",
      flex: 0.08,
      minWidth: 60
    },
    {
      field: "tier",
      headerName: "Tier",
      flex: 0.08,
      minWidth: 60,
      renderCell: (params: GridRenderCellParams) => params.value ?? "-"
    },
  ];

  return (
    <EntityGrid<AiModel>
      rows={rows}
      columns={aiModelColumns}
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
