// components/entity/project/ProjectDetailView.tsx
import React, { useEffect, useState, useMemo } from "react";
import { DetailField, EntityDetailView } from "@/components/entity/EntityDetailView";
import type { Project_Input as Project } from "@/api/models/Project_Input";
import type { Client_Input as Client } from "@/api/models/Client_Input";
import type { ProjectDocument_Input as ProjectDocument } from "@/api/models/ProjectDocument_Input";
import Link from "next/link";
import { ClientsService } from "@/api/services/ClientsService";
import { DocumentsService } from "@/api/services/DocumentsService";
import { formatDate } from "@/app/lib/util";
import { useClientReferenceField } from "@/hooks/useClientReferenceField";
import { usePaginatedEntityList } from "@/hooks/usePaginatedEntityList";
import { CircularProgress } from "@mui/material";
import DocumentGrid from "@/components/entity/document/DocumentGrid";
import DocumentEditView from "@/components/entity/document/DocumentEditView";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";

interface ProjectDetailViewProps {
  item: Project;
  onEdit: () => void;
  detailExtras?: (item: Project) => React.ReactNode;
}

export default function ProjectDetailView({
  item,
  onEdit,
  detailExtras,
}: ProjectDetailViewProps) {
  const { options: clientOptions, loading: loadingClients } = useClientReferenceField();
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      if (item.client_id) {
        try {
          const clientData = await ClientsService.getItemClientsItemIdGet(String(item.client_id));
          setClient(clientData);
        } catch (error) {
          console.error("Failed to fetch client:", error);
        }
      }
    };
    if (item.client_id) fetchClient();
  }, [item.client_id]);

  const {
    items: documents,
    loading: loadingDocuments,
    refetch: refetchDocuments,
  } = usePaginatedEntityList<ProjectDocument>({
    fetchPage: (skip, limit) =>
      DocumentsService.listItemsDocumentsGet(
        skip,
        limit,
        JSON.stringify({ project_id: item._id })
      ),
    enabled: !!item._id,
  });

  const [isNewDocumentOpen, setIsNewDocumentOpen] = useState(false);
  const [newDocumentEntity, setNewDocumentEntity] = useState<ProjectDocument | null>(null);

  const handleDocumentClick = (docId: string) => {
    window.location.href = `/documents?id=${docId}`;
  };

  const handleNewDocument = () => {
    const newDoc: ProjectDocument = {
      project_id: item._id!,
      code: "",
      name: "",
      description: "",
      content: "",
    };
    setNewDocumentEntity(newDoc);
    setIsNewDocumentOpen(true);
  };

  const handleSaveDocument = async (doc: ProjectDocument) => {
    await DocumentsService.createItemDocumentsPost(doc);
    setIsNewDocumentOpen(false);
    setNewDocumentEntity(null);
    refetchDocuments();
  };

  const detailFields: DetailField<Project>[] = useMemo(() => [
    { label: "Code", field: "code" },
    {
      label: "Client",
      field: "client_id",
      render: (value) =>
        value ? (
          loadingClients ? (
            <CircularProgress color="inherit" size={14} />
          ) : (
            <Link
              href={`/clients?id=${value}`}
              className="text-blue-600 dark:text-blue-400 underline"
            >
              {clientOptions.find((opt) => opt.value === String(value))?.label ?? value}
            </Link>
          )
        ) : (
          <span className="text-gray-400">No client</span>
        ),
    },
    {
      label: "Start Date",
      field: "start_date",
      render: (value) => formatDate(value as Project["start_date"]),
    },
    {
      label: "End Date",
      field: "end_date",
      render: (value) => formatDate(value as Project["end_date"]),
    },
    { label: "Description", field: "description" },
  ], [clientOptions, loadingClients]);

  return (
    <div className="space-y-6">
      {/* Main project info */}
      <EntityDetailView<Project>
        item={item}
        fields={detailFields}
        onEdit={onEdit}
        detailExtras={detailExtras}
        modelName="Project"
      />

      {/* Client Section */}
      {client && (
        <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 space-y-4 bg-white dark:bg-gray-900">
          <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Client Info
          </h4>
          <EntityDetailView<Client>
            item={client}
            fields={[
              { label: "Code", field: "code" },
              { label: "Type", field: "type" },
              { label: "Description", field: "description" },
            ]}
            modelName="Client"
          />
        </div>
      )}

      {/* Documents Section */}
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 space-y-4 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Documents
          </h4>
          <Button size="sm" variant="outline" onClick={handleNewDocument}>
            New Document
          </Button>
        </div>
        {loadingDocuments ? (
          <div className="flex justify-center py-8">
            <CircularProgress size={24} />
          </div>
        ) : documents.length > 0 ? (
          <DocumentGrid
            rows={documents}
            onRowClick={handleDocumentClick}
          />
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No documents associated with this project.
          </p>
        )}
      </div>

      {/* New Document Modal */}
      <Modal isOpen={isNewDocumentOpen && !!newDocumentEntity} onClose={() => setIsNewDocumentOpen(false)} className="max-w-[700px] m-4">
        {newDocumentEntity && (
          <DocumentEditView
            item={newDocumentEntity}
            onSubmit={handleSaveDocument}
            onCancel={() => setIsNewDocumentOpen(false)}
            mode="create"
          />
        )}
      </Modal>
    </div>
  );
}
