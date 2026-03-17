// components/entity/document/DocumentEditView.tsx

import React from "react";
import { EntityEditView } from "@/components/entity/EntityEditView";
import type { Project_Input as Project } from "@/api/models/Project_Input";
import { ProjectDocument_Input as ProjectDocument, ProjectDocument_InputRequired as ProjectDocumentRequired } from "@/api/models/ProjectDocument_Input";
import { useProjectReferenceField } from "@/hooks/useProjectReferenceField";
import { applyRequiredFlags } from "@/app/lib/type-utils";

interface DocumentEditViewProps {
  item: ProjectDocument;
  onSubmit: (updatedItem: ProjectDocument) => void;
  onCancel: () => void;
  mode: "create" | "edit";
}

export default function DocumentEditView({
  item,
  onSubmit,
  onCancel,
  mode,
}: DocumentEditViewProps) {
  const { options: projectOptions, loading: loadingProjects } = useProjectReferenceField();

  const baseFields = [
    {
      label: "Project",
      field: "project_id",
      type: "reference",
      options: projectOptions,
      loading: loadingProjects,
    },
    { label: "Code", field: "code", type: "text" },
    { label: "Name", field: "name", type: "text" },
    { label: "Description", field: "description", type: "textarea" },
    { label: "Content", field: "content", type: "textarea" },
  ] as const;

  const formFields = applyRequiredFlags<ProjectDocument, Project>(baseFields, ProjectDocumentRequired);

  return (
    <EntityEditView<ProjectDocument, Project>
      item={item}
      fields={formFields}
      onSubmit={onSubmit}
      onCancel={onCancel}
      mode={mode}
      modelName="Document"
    />
  );
}
