// hooks/useAddressReferenceField.ts
import { useCallback } from "react";
import { useReferenceField } from "./useReferenceField";
import { AddressesService } from "@/api/services/AddressesService";
import type { Address_Input as Address } from "@/api/models/Address_Input";

export function useAddressReferenceField() {
  const fetchAddresses = useCallback(
    () => AddressesService.listItemsAddressesGet(0, 100),
    []
  );

  const getAddressId = useCallback(
    (a: Address) => String(a._id),
    []
  );

  const getAddressLabel = useCallback(
    (a: Address) => `${a.street}, ${a.city}, ${a.state}`.trim(),
    []
  );

  return useReferenceField(fetchAddresses, getAddressId, getAddressLabel);
}