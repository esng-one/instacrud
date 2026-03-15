//components/entity/user/UserEditView.tsx

import { useMemo } from "react";
import { EntityEditView, EditField } from "@/components/entity/EntityEditView";
import { formatEnum } from "@/app/lib/util";
import { Role } from "@/api/models/Role";
import type { UserResponse } from "@/api/models/UserResponse";
import type { UserUpdate } from "@/api/models/UserUpdate";
import type { UserCreate } from "@/api/models/UserCreate";
import type { OrganizationResponse } from "@/api/models/OrganizationResponse";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useOrganizationReferenceField } from "@/hooks/useOrganizationReferenceField";

// Create a common type for form fields that works with both UserCreate and UserUpdate
type CommonUserFields = {
  email?: string | null;
  name?: string | null;
  password?: string | null;
  role?: Role | null;
  organization_id?: string | null;
};

interface UserEditViewProps {
  item: UserResponse | UserUpdate | UserCreate;
  onSubmit: (updatedItem: UserCreate | UserUpdate) => void;
  onCancel: () => void;
  mode: "create" | "edit";
  selectedOrganizationId?: string | null;
}

export default function UserEditView({
  item,
  onSubmit,
  onCancel,
  mode,
  selectedOrganizationId,
}: UserEditViewProps) {
  const { currentUser } = useCurrentUser();
  const { options: organizationOptions, loading: loadingOrganizations } = useOrganizationReferenceField();

  // Form fields for user editing
  const formFields: EditField<CommonUserFields, OrganizationResponse>[] = useMemo(() => {
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
      { label: "Name", field: "name", type: "text" },
      { label: "Password", field: "password", type: "text" },
      {
        label: "Role",
        field: "role",
        type: "select",
        options: roleOptions,
        render: (value: string | number | boolean) => formatEnum(String(value))
      },
      {
        label: "Organization",
        field: "organization_id",
        type: "reference",
        options: organizationOptions,
        loading: loadingOrganizations,
        disabled: currentUser?.role !== "ADMIN",
      },
    ];
  }, [currentUser?.role, selectedOrganizationId, organizationOptions, loadingOrganizations]);

  return (
    <EntityEditView<CommonUserFields, OrganizationResponse>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="User"
    />
  );
}