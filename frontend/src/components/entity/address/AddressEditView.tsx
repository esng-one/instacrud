//components/entity/address/AddressEditView.tsx

import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import { Address_Input as Address, Address_InputRequired as AddressRequired } from "@/api/models/Address_Input";
import {applyRequiredFlags} from "@/app/lib/type-utils";

const baseFields = [
  { label: "Street", field: "street", type: "text" },
  { label: "Street 2", field: "street2", type: "text" },
  { label: "City", field: "city", type: "text" },
  { label: "State", field: "state", type: "text" },
  { label: "Zip Code", field: "zip_code", type: "text" },
  { label: "Country", field: "country", type: "text" },
] as const;

export const formFields = applyRequiredFlags<Address>(baseFields, AddressRequired);

interface AddressEditViewProps {
  item: Address;
  onSubmit: (updatedItem: Address) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function AddressEditView({
  item,
  onSubmit,
  onCancel,
  mode,
}: AddressEditViewProps) {
  return (
    <EntityEditView<Address>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Address"
    />
  );
}
