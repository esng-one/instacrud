// hooks/useContactReferenceField.ts
import { useCallback } from "react";
import { useReferenceField } from "./useReferenceField";
import { ContactsService } from "@/api/services/ContactsService";
import type { Contact_Input as Contact } from "@/api/models/Contact_Input";

export function useContactReferenceField() {
  const fetchContacts = useCallback(
    () => ContactsService.listItemsContactsGet(0, 100),
    []
  );

  const getContactId = useCallback(
    (c: Contact) => String(c._id),
    []
  );

  const getContactLabel = useCallback(
    (c: Contact) => c.name || c.email || "(unnamed contact)",
    []
  );

  return useReferenceField(fetchContacts, getContactId, getContactLabel);
}