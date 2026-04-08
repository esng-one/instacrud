import React from "react";
import { EntityDetailView } from "@/components/entity/EntityDetailView";
import type { Contact_Input as Contact } from "@/api/models/Contact_Input";

export const detailFields: { label: string; field: keyof Contact; render?: (value: Contact[keyof Contact], item: Contact) => React.ReactNode }[] = [
  { label: "Title", field: "title" },
  { label: "Email", field: "email" },
  { label: "Phone", field: "phone" },
];

interface ContactDetailViewProps {
  item: Contact;
  onEdit: () => void;
  detailExtras?: (item: Contact) => React.ReactNode;
}

export default function ContactDetailView({ item, onEdit, detailExtras }: ContactDetailViewProps) {
  return <EntityDetailView<Contact> item={item} fields={detailFields} onEdit={onEdit} detailExtras={detailExtras} modelName="Contact" />;
}
