//components/entity/user/UserDetailView.tsx

import React, { useMemo } from "react";
import { DetailField, EntityDetailView } from "@/components/entity/EntityDetailView";
import { formatEnum } from "@/app/lib/util";
import type { UserResponse } from "@/api/models/UserResponse";
import { useOrganizationReferenceField } from "@/hooks/useOrganizationReferenceField";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMeContext } from "@/context/MeContext";
import { CircularProgress } from "@mui/material";
import Link from "next/link";

interface UserDetailViewProps {
  item: UserResponse;
  onEdit: () => void;
  detailExtras?: (item: UserResponse) => React.ReactNode;
}

export default function UserDetailView({
  item,
  onEdit,
  detailExtras,
}: UserDetailViewProps) {
  const { currentUser } = useCurrentUser();
  const { me } = useMeContext();
  const isAdmin = currentUser?.role === "ADMIN";
  const { options: organizationOptions, loading: loadingOrganizations } = useOrganizationReferenceField(0, isAdmin);

  const detailFields: DetailField<UserResponse>[] = useMemo(() => [
    { label: "Email", field: "email" },
    { label: "Name", field: "name" },
    { label: "Role", field: "role", render: (value) => formatEnum(String(value)) },
    {
      label: "Organization",
      field: "organization_id",
      render: (value) =>
        value ? (
          loadingOrganizations ? (
            <CircularProgress color="inherit" size={14} />
          ) : isAdmin ? (
            <Link
              href={`/organizations?id=${value}`}
              className="text-blue-600 dark:text-blue-400 underline"
            >
              {organizationOptions.find((opt) => opt.value === String(value))?.label ?? value}
            </Link>
          ) : (
            <span>{me?.organization?.name ?? String(value)}</span>
          )
        ) : (
          <span className="text-gray-400">No organization</span>
        ),
    },
    { label: "Organization ID", field: "organization_id" },
  ], [organizationOptions, loadingOrganizations, isAdmin, me]);

  return (
    <EntityDetailView<UserResponse>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      detailExtras={detailExtras}
      modelName="User"
    />
  );
}