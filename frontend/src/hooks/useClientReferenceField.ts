// hooks/useClientReferenceField.ts
import { useCallback } from "react";
import { useReferenceField } from "@/hooks/useReferenceField";
import { ClientsService } from "@/api/services/ClientsService";
import type { Client_Input as Client } from "@/api/models/Client_Input";

export function useClientReferenceField() {
  const fetchClients = useCallback(
    () => ClientsService.listItemsClientsGet(0, 100),
    []
  );

  const getClientId = useCallback(
    (c: Client) => String(c._id),
    []
  );

  const getClientLabel = useCallback(
    (c: Client) => c.name || c.code || String(c._id),
    []
  );

  return useReferenceField(fetchClients, getClientId, getClientLabel);
}
