// hooks/useOrganizationReferenceField.ts

import { useCallback } from "react";
import { useReferenceField } from "./useReferenceField";
import { AdminService } from "@/api/services/AdminService";
import type { OrganizationResponse } from "@/api/models/OrganizationResponse";

export function useOrganizationReferenceField(refreshKey: number = 0, enabled: boolean = true) {
  const fetchFn = useCallback(() => AdminService.listOrganizationsAdminOrganizationsGet(), []);
  const getValue = useCallback((org: OrganizationResponse) => org.id, []);
  const getLabel = useCallback((org: OrganizationResponse) => org.name, []);

  return useReferenceField<OrganizationResponse>(
    fetchFn,
    getValue,
    getLabel,
    refreshKey,
    enabled,
  );
}