//components/entity/address/AddressDetailView.tsx

import React from "react";
import { EntityDetailView } from "@/components/entity/EntityDetailView";
import type { Address_Input as Address } from "@/api/models/Address_Input";

export const detailFields: { 
  label: string; 
  field: keyof Address; 
}[] = [
  { label: "Street", field: "street" },
  { label: "Street 2", field: "street2" },
  { label: "City", field: "city" },
  { label: "State", field: "state" },
  { label: "Zip Code", field: "zip_code" },
  { label: "Country", field: "country" },
];

interface AddressDetailViewProps {
  item: Address;
  onEdit: () => void;
  detailExtras?: (item: Address) => React.ReactNode;
}

export default function AddressDetailView({
  item,
  onEdit,
  detailExtras,
}: AddressDetailViewProps) {
  return (
    <EntityDetailView<Address>
      item={item}
      fields={detailFields}
      onEdit={onEdit}
      detailExtras={detailExtras}
      modelName="Address"
    />
  );
}
