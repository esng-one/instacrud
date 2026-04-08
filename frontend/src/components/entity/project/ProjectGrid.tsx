// components/entity/project/ProjectGrid.tsx
import { GridColDef } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { Project_Input as Project } from "@/api/models/Project_Input";
import { formatDate } from "@/app/lib/util";

const projectColumns: GridColDef<Project>[] = [
  { field: "name", headerName: "Name", flex: 1, minWidth: 150 },
  { field: "code", headerName: "Code", flex: 0.5, minWidth: 100 },
  { field: "start_date", headerName: "Start Date", flex: 0.5, minWidth: 100, renderCell: ({ value }) => formatDate(value as Project["start_date"])},
  { field: "end_date", headerName: "End Date", flex: 0.5, minWidth: 100, renderCell: ({ value }) => formatDate(value as Project["end_date"])},
  { field: "description", headerName: "Description", flex: 1, minWidth: 150 },
];

interface ProjectGridProps {
  rows: Project[];
  page: number;
  pageSize: number;
  totalCount: number;
  loading?: boolean;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: Project) => void;
  hideFooter?: boolean;
}

export default function ProjectGrid({
  rows,
  page,
  pageSize,
  totalCount,
  loading,
  onPageChange,
  onRowClick,
  onDelete,
  hideFooter,
}: ProjectGridProps) {
  return (
    <EntityGrid<Project>
      rows={rows}
      columns={projectColumns}
      idKey="_id"
      page={page}
      pageSize={pageSize}
      totalCount={totalCount}
      loading={loading}
      onPageChange={onPageChange}
      onRowClick={onRowClick}
      onDelete={onDelete}
      hideFooter={hideFooter}
    />
  );
}
