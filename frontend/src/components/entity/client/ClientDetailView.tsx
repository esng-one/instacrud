// components/entity/client/ClientDetailView.tsx
"use client";
import React from "react";
import { EntityDetailView } from "@/components/entity/EntityDetailView";
import type { Client_Input as Client } from "@/api/models/Client_Input";
import { formatEnum } from "@/app/lib/util";

export const detailFields: {
  label: string;
  field: keyof Client;
  render?: (value: Client[keyof Client], item: Client) => React.ReactNode;
}[] = [
  { label: "Code", field: "code" },
  { label: "Type", field: "type", render: (value) => formatEnum(String(value)) },
  { label: "Description", field: "description" },
];

interface ClientDetailViewProps {
  item: Client;
  onEdit: () => void;
  detailExtras?: (item: Client) => React.ReactNode;
}

export default function ClientDetailView({
  item,
  onEdit,
  detailExtras,
}: ClientDetailViewProps) {
  return (
    <EntityDetailView<Client>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      detailExtras={detailExtras}
      modelName="Client"
    />
  );
}
