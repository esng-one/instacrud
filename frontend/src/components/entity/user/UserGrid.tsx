//components/entity/user/UserGrid.tsx

import { GridColDef } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { UserResponse } from "@/api/models/UserResponse";
import { formatEnum } from "@/app/lib/util";

const userColumns: GridColDef[] = [
  { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
  { field: "name", headerName: "Name", flex: 1, minWidth: 150 },
  { field: "role", headerName: "Role", flex: 0.5, minWidth: 120,
    renderCell: (params) => formatEnum(params.value ?? ""),
  },
  { field: "organization_id", headerName: "Organization", flex: 1, minWidth: 200 },
];

interface UserGridProps {
  rows: UserResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: UserResponse) => void;
}

export default function UserGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: UserGridProps) {
  return (
    <EntityGrid<UserResponse>
      rows={rows}
      columns={userColumns}
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