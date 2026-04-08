// hooks/useTierReferenceField.ts
import { useCallback } from "react";
import { useReferenceField } from "@/hooks/useReferenceField";
import { TiersService } from "@/api/services/TiersService";
import type { Tier_Input as Tier } from "@/api/models/Tier_Input";

export function useTierReferenceField() {
  const fetchTiers = useCallback(
    () => TiersService.listItemsAdminTiersGet(0, 100),
    []
  );

  const getTierId = useCallback(
    (t: Tier) => String(t._id),
    []
  );

  const getTierLabel = useCallback(
    (t: Tier) => t.name || t.code || String(t._id),
    []
  );

  return useReferenceField(fetchTiers, getTierId, getTierLabel);
}
