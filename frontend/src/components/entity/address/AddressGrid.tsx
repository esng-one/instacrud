//components/entity/address/AddressGrid.tsx

import { GridColDef } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { Address_Input as Address } from "@/api/models/Address_Input";

const addressColumns: GridColDef[] = [
  { field: "street", headerName: "Street", flex: 1, minWidth: 150 },
  { field: "street2", headerName: "Street 2", flex: 1, minWidth: 100 },
  { field: "city", headerName: "City", flex: 0.5, minWidth: 120 },
  { field: "state", headerName: "State", flex: 0.5, minWidth: 80 },
  { field: "zip_code", headerName: "Zip Code", flex: 0.5, minWidth: 80 },
  { field: "country", headerName: "Country", flex: 0.5, minWidth: 80 },
];

interface AddressGridProps {
  rows: Address[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: Address) => void;
}

export default function AddressGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: AddressGridProps) {
  return (
    <EntityGrid<Address>
      rows={rows}
      columns={addressColumns}
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