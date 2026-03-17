// components/entity/client/ClientGrid.tsx
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { Client_Input as Client } from "@/api/models/Client_Input";
import { formatEnum, formatDate } from "@/app/lib/util";

const clientColumns: GridColDef<Client>[] = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 150 },
    { field: "code", headerName: "Code", flex: 0.5, minWidth: 100 },
    { field: "description", headerName: "Description", flex: 1, minWidth: 150 },
    {
      field: "type",
      headerName: "Type",
      flex: 0.5,
      minWidth: 90,
      renderCell: (params: GridRenderCellParams<Client, Client["type"]>) =>
        formatEnum(String(params.value ?? "")),
      },
    {
      field: "updated_at",
      headerName: "Updated At",
      flex: 0.5,
      minWidth: 100,
      renderCell: ({ value }) => formatDate(value as Client["updated_at"]),
    },
];

interface ClientGridProps {
  rows: Client[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: Client) => void;
}

export default function ClientGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: ClientGridProps) {
  return (
    <EntityGrid<Client>
      rows={rows}
      columns={clientColumns}
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