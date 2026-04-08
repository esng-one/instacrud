// components/entity/client/ClientDetailExtras.tsx

import {useCallback, useState} from "react";
import { EntityDetailExtras } from "@/components/entity/EntityDetailExtras";
import ProjectGrid from "@/components/entity/project/ProjectGrid";
import ReferenceSelector from "@/components/form/ReferenceSelector";
import { ContactsService } from "@/api/services/ContactsService";
import { AddressesService } from "@/api/services/AddressesService";
import { ProjectsService } from "@/api/services/ProjectsService";
import { useProjectReferenceField } from "@/hooks/useProjectReferenceField";
import { usePaginatedEntityList } from "@/hooks/usePaginatedEntityList";

import type { Client_Input as Client } from "@/api/models/Client_Input";
import type { Contact_Input as Contact } from "@/api/models/Contact_Input";
import type { Address_Input as Address } from "@/api/models/Address_Input";
import type { Project_Input as Project } from "@/api/models/Project_Input";
import ProjectEditView from "../project/ProjectEditView";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import {ReferenceOption} from "@/hooks/useReferenceField";

export default function ClientDetailExtras({
  item,
  refreshContactsKey,
  refreshAddressesKey,
  contactsForceLoading,
  addressesForceLoading,
  contactOptions,
  addressOptions,
  loadingContacts,
  loadingAddresses,
  onNewContact,
  onNewAddress,
  onEditContact,
  onEditAddress,
  onAddContact,
  onAddAddress,
  onRemoveContact,
  onRemoveAddress,
}: {
  item: Client;
  refreshContactsKey?: number;
  refreshAddressesKey?: number;
  contactsForceLoading?: boolean;
  addressesForceLoading?: boolean;
  contactOptions: ReferenceOption<Contact>[];
  addressOptions: ReferenceOption<Address>[];
  loadingContacts: boolean;
  loadingAddresses: boolean;
  onNewContact?: () => void;
  onNewAddress?: () => void;
  onEditContact?: (contact: Contact) => void | Promise<void>;
  onEditAddress?: (address: Address) => void | Promise<void>;
  onRemoveContact?: (contact: Contact) => void | Promise<void>;
  onRemoveAddress?: (address: Address) => void | Promise<void>;
  onAddContact?: (contactId: string) => void | Promise<void>;
  onAddAddress?: (addressId: string) => void | Promise<void>;
}) {
  const { options: projectOptions, loading: loadingProjects, refetch: refetchProjectOptions } = useProjectReferenceField();

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [newProjectEntity, setNewProjectEntity] = useState<Project | null>(null);

  // fetch projects specifically for this client
  const {
    items: projectItems,
    page: projectPage,
    pageSize: projectPageSize,
    totalCount: projectTotalCount,
    loading: loadingProjectsPage,
    handlePageChange: handleProjectPageChange,
    refetch: refetchProjects,
  } = usePaginatedEntityList<Project>({
    fetchPage: (skip, limit) =>
      ProjectsService.listItemsProjectsGet(
        skip,
        limit,
        JSON.stringify({ client_id: item._id })
      ),
  });

  const fetchContacts = useCallback(() => {
    const ids = item.contact_ids ?? [];
    return ids.length > 0
      ? ContactsService.listItemsContactsGet(
          0,
          ids.length,
          JSON.stringify({ _id: { $in: ids } })
        )
      : Promise.resolve([]);
  }, [item.contact_ids]);

  const fetchAddresses = useCallback(() => {
    const ids = item.address_ids ?? [];
    return ids.length > 0
      ? AddressesService.listItemsAddressesGet(
          0,
          ids.length,
          JSON.stringify({ _id: { $in: ids } })
        )
      : Promise.resolve([]);
  }, [item.address_ids]);

  const handleNewProjectForClient = (prefill?: string) => {
    const newProject: Project = {
      code: "",
      name: prefill ?? "",
      client_id: String(item._id),
      start_date: new Date().toISOString(),
      end_date: null,
      description: "",
    };
    setNewProjectEntity(newProject);
    setIsNewProjectOpen(true);
  };

  return (
    <>
      {/* Contacts */}
      <EntityDetailExtras<Contact>
        ids={item.contact_ids}
        fetchAllFn={fetchContacts}
        title="Contacts"
        nameField="name"
        modelName="Contact"
        variant="compact"
        fields={[
          { label: "Title", field: "title" },
          { label: "Email", field: "email" },
          { label: "Phone", field: "phone" },
        ]}
        onNewItem={onNewContact}
        onEditItem={onEditContact}
        canCreate
        canAddExisting
        addOptions={contactOptions}
        addOptionsLoading={loadingContacts}
        onAddItem={(id) => {
          onAddContact?.(id);
        }}
        onRemoveItem={(contact) => {
          onRemoveContact?.(contact);
        }}
        forceLoading={contactsForceLoading}
        refreshKey={refreshContactsKey}
      />

      {/* Addresses */}
      <EntityDetailExtras<Address>
        ids={item.address_ids}
        fetchAllFn={fetchAddresses}
        title="Addresses"
        nameField="street"
        modelName="Address"
        variant="compact"
        fields={[
          { label: "Street 2", field: "street2" },
          {
            label: "Location",
            field: "city",
            render: (_, addr) => {
              const parts = [addr.city, addr.state, addr.zip_code].filter(Boolean);
              return parts.length > 0 ? parts.join(", ") : null;
            },
          },
          { label: "Country", field: "country" },
        ]}
        onNewItem={onNewAddress}
        onEditItem={onEditAddress}
        canCreate
        canAddExisting
        addOptions={addressOptions}
        addOptionsLoading={loadingAddresses}
        onAddItem={(id) => {
          onAddAddress?.(id);
        }}
        onRemoveItem={(address) => {
          onRemoveAddress?.(address);
        }}
        forceLoading={addressesForceLoading}
        refreshKey={refreshAddressesKey}
      />

      {/* Projects */}
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-gray-900 space-y-4">
        <div className="flex gap-2 items-center">
          <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Projects
          </h4>
          <div className="flex-1"/>
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsAddingProject(true)}
              disabled={isAddingProject}
            >
              Add Project
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleNewProjectForClient()}
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Inline Add Project */}
        {isAddingProject && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ReferenceSelector<Project>
                  field="client_id"
                  value={selectedProjectId}
                  options={projectOptions}
                  loading={loadingProjects}
                  onChange={(_, projectId) => setSelectedProjectId(String(projectId))}
                  onCreateNew={(prefill) => {
                    handleNewProjectForClient(prefill);
                  }}
                  createLabel="Add Project"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  if (!selectedProjectId) return;
                  await ProjectsService.patchItemProjectsItemIdPatch(String(selectedProjectId), {
                    client_id: String(item._id),
                  });
                  setIsAddingProject(false);
                  setSelectedProjectId(null);
                  refetchProjects();
                }}
                disabled={!selectedProjectId}
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAddingProject(false);
                  setSelectedProjectId(null);
                }}
              >
                Cancel
              </Button>
            </div>
        )}

        <ProjectGrid
            rows={projectItems}
            page={projectPage}
            pageSize={projectPageSize}
            totalCount={projectTotalCount}
            loading={loadingProjectsPage}
            onPageChange={handleProjectPageChange}
            onRowClick={(id) => (window.location.href = `/projects?id=${id}`)}
            onDelete={async (id) => {
              await ProjectsService.patchItemProjectsItemIdPatch(String(id), {client_id: null});
              refetchProjects();
            }}
        />
      </div>

      {/* New Project Modal */}
      <Modal isOpen={isNewProjectOpen && !!newProjectEntity} onClose={() => setIsNewProjectOpen(false)} className="max-w-[700px] m-4">
        {newProjectEntity && (
          <ProjectEditView
            item={newProjectEntity}
            onSubmit={async (project) => {
              await ProjectsService.createItemProjectsPost(project);
              setIsNewProjectOpen(false);
              refetchProjects();
              refetchProjectOptions();
            }}
            onCancel={() => setIsNewProjectOpen(false)}
            mode="create"
          />
        )}
      </Modal>
    </>
  );
}
