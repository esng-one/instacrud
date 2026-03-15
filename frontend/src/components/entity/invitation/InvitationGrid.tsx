//components/entity/invitation/InvitationGrid.tsx

"use client";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { Tooltip } from "@mui/material";
import { LinkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/button/Button";
import toast from "react-hot-toast";
import { EntityGrid } from "@/components/entity/EntityGrid";
import type { InvitationListResponse } from "@/api/models/InvitationListResponse";
import { formatEnum, formatDateTime } from "@/app/lib/util";

interface InvitationGridProps {
  rows: InvitationListResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: InvitationListResponse) => void;
}

export default function InvitationGrid({
  rows,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onRowClick,
  onDelete,
}: InvitationGridProps) {
  
  const handleCopyLink = async (invitationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const baseUrl = window.location.origin;
    const invitationLink = `${baseUrl}/signup?invitation_id=${invitationId}`;
    
    try {
      await navigator.clipboard.writeText(invitationLink);
      toast.success("Invitation link copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy invitation link:", error);
      toast.error("Failed to copy invitation link");
    }
  };

  const handleCopyId = async (invitationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(invitationId);
      toast.success("ID copied");
    } catch (error) {
      toast.error("Failed to copy ID");
    }
  };

  const invitationColumns: GridColDef[] = [
    { 
      field: "id", 
      headerName: "Invitation ID", 
      flex: 1, 
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => {
        return (
          <span 
            onClick={(e) => handleCopyId(params.value, e)}
            className="cursor-pointer select-none"
            title="Click to copy invitation ID"
          >
            {params.value}
          </span>
        );
      }
    },
    { field: "organization_id", headerName: "Organization ID", flex: 1, minWidth: 200 },
    { field: "invited_by", headerName: "Invited By", flex: 1, minWidth: 150 },
    { 
      field: "invited_at", 
      headerName: "Invited At", 
      flex: 1, 
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => formatDateTime(params.value)
    },
    {
      field: "expires_at",
      headerName: "Expires At",
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => formatDateTime(params.value)
    },
    { field: "role", headerName: "Role", flex: 0.5, minWidth: 120,
      renderCell: (params) => formatEnum(params.value ?? ""),
     },
    { 
      field: "accepted", 
      headerName: "Accepted", 
      flex: 0.5, 
      minWidth: 100,
      renderCell: (params: GridRenderCellParams) => {
        return params.value ? "Yes" : "No";
      }
    },
    {
      field: "invintation_link",
      headerName: "Link", 
      sortable: false,
      minWidth: 100,
      flex: 0.3,
      renderCell: (params: GridRenderCellParams) => {
        return (
          <Tooltip title="Copy Invitation Link">
            <Button 
              size="sm" 
              variant="link" 
              onClick={(e) => handleCopyLink(params.row.id, e)}
            >
              <LinkIcon width={20} height={20} />
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <EntityGrid<InvitationListResponse>
      rows={rows}
      columns={invitationColumns}
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