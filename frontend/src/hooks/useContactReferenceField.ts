// hooks/useContactReferenceField.ts
import { useCallback } from "react";
import { useReferenceField } from "./useReferenceField";
import { ContactsService } from "@/api/services/ContactsService";
import type { ContactListItem } from "@/api/models/ContactListItem";

export function useContactReferenceField() {
  const fetchContacts = useCallback(
    () => ContactsService.listItemsContactsGet(0, 100),
    []
  );

  const getContactId = useCallback(
    (c: ContactListItem) => String(c._id),
    []
  );

  const getContactLabel = useCallback(
    (c: ContactListItem) => c.name || c.email || "(unnamed contact)",
    []
  );

  return useReferenceField(fetchContacts, getContactId, getContactLabel);
}
