//components/entity/invitation/InvitationDetailView.tsx

import React from "react";
import { EntityDetailView } from "@/components/entity/EntityDetailView";
import { formatEnum, formatDateTime } from "@/app/lib/util";
import type { InvitationListResponse } from "@/api/models/InvitationListResponse";

export const detailFields: { 
  label: string; 
  field: keyof InvitationListResponse;
  render?: (value: any) => React.ReactNode;
}[] = [
  { label: "Invitation ID", field: "id" },
  { label: "Organization ID", field: "organization_id" },
  { label: "Invited By", field: "invited_by" },
  { label: "Invited At", field: "invited_at", render: (value: string) => formatDateTime(value) },
  { label: "Expires At", field: "expires_at", render: (value: string) => formatDateTime(value) },
  { label: "Role", field: "role", render: (value: string) => formatEnum(value) },
  { 
    label: "Accepted", 
    field: "accepted",
    render: (value: boolean) => value ? "Yes" : "No"
  },
];

interface InvitationDetailViewProps {
  item: InvitationListResponse;
  onEdit?: () => void;
  detailExtras?: (item: InvitationListResponse) => React.ReactNode;
}

export default function InvitationDetailView({
  item,
  onEdit,
  detailExtras,
}: InvitationDetailViewProps) {
  return (
    <EntityDetailView<InvitationListResponse>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      detailExtras={detailExtras}
      modelName="Invitation"
    />
  );
}