import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import { Contact_Input as Contact, Contact_InputRequired as ContactRequired } from "@/api/models/Contact_Input";
import { applyRequiredFlags } from "@/app/lib/type-utils";

const baseFields = [
  { label: "Name", field: "name", type: "text" },
  { label: "Title", field: "title", type: "text" },
  { label: "Email", field: "email", type: "text" },
  { label: "Phone", field: "phone", type: "text" },
] as const;

export const formFields = applyRequiredFlags<Contact>(baseFields, ContactRequired);

interface ContactEditViewProps {
  item: Contact;
  onSubmit: (updatedItem: Contact) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function ContactEditView({ item, onSubmit, onCancel, mode }: ContactEditViewProps) {
  return (
    <EntityEditView<Contact>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Contact"
    />
  );
}
