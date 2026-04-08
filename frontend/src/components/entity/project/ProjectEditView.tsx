// components/entity/project/ProjectEditView.tsx

import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import type { Client_Input as Client } from "@/api/models/Client_Input";
import { Project_Input as Project, Project_InputRequired as ProjectRequired } from "@/api/models/Project_Input";
import { useClientReferenceField } from "@/hooks/useClientReferenceField";
import {applyRequiredFlags} from "@/app/lib/type-utils";

interface ProjectEditViewProps {
  item: Project;
  onSubmit: (updatedItem: Project) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function ProjectEditView({
  item,
  onSubmit,
  onCancel,
  mode,
}: ProjectEditViewProps) {
  const { options: clientOptions, loading: loadingClients } = useClientReferenceField();

  const baseFields = [
    { label: "Name", field: "name", type: "text" },
    { label: "Code", field: "code", type: "text" },
    {
      label: "Client",
      field: "client_id",
      type: "reference",
      options: clientOptions,
      loading: loadingClients,
    },
    { label: "Start Date", field: "start_date", type: "date" },
    { label: "End Date", field: "end_date", type: "date" },
    { label: "Description", field: "description", type: "text" },
  ] as const;

  const formFields = applyRequiredFlags<Project, Client>(baseFields, ProjectRequired);

  return (
    <EntityEditView<Project, Client>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Project"
    />
  );
}
