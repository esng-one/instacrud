//components/entity/invitation/InvitationEditView.tsx

import React, { useMemo } from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import { formatEnum } from "@/app/lib/util";
import { Role } from "@/api/models/Role";
import type { InviteUserCreate } from "@/api/models/InviteUserCreate";
import useCurrentUser from "@/hooks/useCurrentUser";

interface InvitationEditViewProps {
  item: InviteUserCreate;
  onSubmit: (updatedItem: InviteUserCreate) => void;
  onCancel: () => void;
  mode: "create";
  selectedOrganizationId?: string | null;
  canSubmit?: boolean;
  extraContent?: React.ReactNode;
}

export default function InvitationEditView({
  item,
  onSubmit,
  onCancel,
  mode,
  selectedOrganizationId,
  canSubmit,
  extraContent,
}: InvitationEditViewProps) {
  const { currentUser } = useCurrentUser();
  
  // Handle form submission - convert expires_in_seconds from string to number if needed
  const handleSubmit = (formData: InviteUserCreate) => {
    const processedData = { ...formData };
    
    // Convert expires_in_seconds from string to number if it exists
    if (processedData.expires_in_seconds && typeof processedData.expires_in_seconds === 'string') {
      processedData.expires_in_seconds = parseInt(processedData.expires_in_seconds, 10);
    }
    
    onSubmit(processedData);
  };

  // Form fields for invitation editing
  const formFields: { 
    label: string; 
    field: keyof InviteUserCreate; 
    type: "text" | "select"; 
    options?: string[];
    render?: (value: string | number | boolean) => React.ReactNode;
    disabled?: boolean;
  }[] = useMemo(() => {
    // Filter role options based on user role and organization selection
    let roleOptions = Object.values(Role);
    
    if (currentUser?.role === "ORG_ADMIN") {
      // ORG_ADMINs cannot assign ADMIN role under any circumstances
      roleOptions = roleOptions.filter(role => role !== Role.ADMIN);
    } else if (!selectedOrganizationId) {
      // If no organization selected and user is ADMIN, only ADMIN role allowed
      roleOptions = [Role.ADMIN];
    }

    return [
      { label: "Email", field: "email", type: "text" },
      { 
        label: "Role", 
        field: "role", 
        type: "select",
        options: roleOptions,
        render: (value: string | number | boolean) => formatEnum(String(value))
      },
      // Organization ID field is hidden - it gets auto-filled from the selected organization
      { 
        label: "Expires in Seconds (optional)", 
        field: "expires_in_seconds", 
        type: "text" // Using text type, will convert to number in submit handler
      },
    ];
  }, [currentUser?.role, selectedOrganizationId]);

  return (
    <EntityEditView<InviteUserCreate>
      item={item}
      fields={formFields}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Invitation"
      canSubmit={canSubmit}
      extraContent={extraContent}
    />
  );
}
