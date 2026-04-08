// components/entity/client/ClientEditView.tsx
import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import { Client_Input as Client, Client_InputRequired as ClientRequired } from "@/api/models/Client_Input";
import { ClientType } from "@/api/models/ClientType";
import { formatEnum } from "@/app/lib/util";
import {applyRequiredFlags} from "@/app/lib/type-utils";

const baseFields = [
  { label: "Name", field: "name", type: "text" },
  { label: "Code", field: "code", type: "text" },
  { label: "Type", field: "type", type: "select", options: Object.values(ClientType), render: (value: string | number | boolean) => formatEnum(String(value)) },
  { label: "Description", field: "description", type: "text" },
] as const;

export const formFields = applyRequiredFlags<Client>(baseFields, ClientRequired);

interface ClientEditViewProps {
  item: Client;
  onSubmit: (updatedItem: Client) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function ClientEditView({
  item,
  onSubmit,
  onCancel,
  mode,
}: ClientEditViewProps) {
  return (
    <EntityEditView<Client>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Client"
    />
  );
}
