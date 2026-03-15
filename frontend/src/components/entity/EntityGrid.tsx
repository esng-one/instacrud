// components/entity/EntityGrid.tsx
"use client";
import { DataGrid, GridColDef, GridRowParams, GridRenderCellParams } from "@mui/x-data-grid";
import { Tooltip } from "@mui/material";
import { Cross2Icon } from "@radix-ui/react-icons";
import Button from "@/components/ui/button/Button";

interface EntityGridProps<T> {
  rows: T[];
  columns: GridColDef[];
  idKey: keyof T;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: T) => void;
  hideFooter?: boolean;
  loading?: boolean;
}

/**
 * Generic grid to display a list of items in a DataGrid.
 * Adds an "id" field from idKey and an optional delete action column.
 */
export function EntityGrid<T extends Record<string, unknown>>({
  rows,
  columns,
  idKey,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onRowClick,
  onDelete,
  hideFooter,
  loading = false,
}: EntityGridProps<T>) {
  // Map items so DataGrid can use a unique 'id' property
  const gridRows = rows.map((row) => ({ ...row, id: row[idKey] }));

  // Define a delete-action column if onDelete handler is provided
  const actionColumn: GridColDef = {
    field: "action",
    headerName: "Action",
    sortable: false,
    minWidth: 100,
    flex: 0.3,
    renderCell: (params: GridRenderCellParams) => {
      const onDeleteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const row = params.row as T;
        if (onDelete) {
          await onDelete(params.id as string, row);
        }
      };
      return (
        <Tooltip title="Delete Item">
          <Button size="sm" variant="link" onClick={onDeleteClick}>
            <Cross2Icon width={20} height={20} />
          </Button>
        </Tooltip>
      );
    },
  };

  // Include the action column if deletion is enabled (and not already present)
  const gridColumns = [...columns];
  if (onDelete && !gridColumns.some((col) => col.field === "action")) {
    gridColumns.push(actionColumn);
  }

  return (
    <div>
      <DataGrid
        rows={gridRows}
        columns={gridColumns}
        pageSizeOptions={[10, 50, 100]}
        paginationMode="server"
        rowCount={totalCount}
        paginationModel={{
          page: page ?? 0,
          pageSize: pageSize ?? 50,
        }}
        onPaginationModelChange={(model) =>
          onPageChange?.(model.page, model.pageSize)
        }
        autoHeight
        onRowClick={(params: GridRowParams) => {
          onRowClick?.(params.id as string);
        }}
        localeText={{
          paginationDisplayedRows: ({ from, to }: { from: number; to: number }) =>
            `${from}-${to}`,
        }}
        hideFooter={hideFooter}
        loading={loading}
      />
    </div>
  );
}
