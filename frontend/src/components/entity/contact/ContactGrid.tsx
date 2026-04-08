import { GridColDef } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { Contact_Input as Contact } from "@/api/models/Contact_Input";

const contactColumns: GridColDef[] = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 150 },
    { field: "title", headerName: "Title", flex: 1, minWidth: 120 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 150 },
    { field: "phone", headerName: "Phone", flex: 1, minWidth: 120 },
];

interface ContactGridProps {
  rows: Contact[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: Contact) => void;
}

export default function ContactGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: ContactGridProps) {
  return (
    <EntityGrid<Contact>
      rows={rows}
      columns={contactColumns}
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
