// clients/page.tsx

"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircularProgress, Box, ThemeProvider } from "@mui/material";
import toast from "react-hot-toast";
import { useModal } from "@/hooks/useModal";
import { usePaginatedEntityList } from "@/hooks/usePaginatedEntityList";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useTailwindMuiTheme } from "@/app/lib/util";
import { getApiErrorInfo } from "@/app/lib/api-error";

import { ClientsService } from "@/api/services/ClientsService";
import { ContactsService } from "@/api/services/ContactsService";
import { AddressesService } from "@/api/services/AddressesService";
import { ClientType } from "@/api/models/ClientType";
import type { Client_Input as Client } from "@/api/models/Client_Input";
import type { Contact_Input as Contact } from "@/api/models/Contact_Input";
import type { Address_Input as Address } from "@/api/models/Address_Input";

import ClientGrid from "@/components/entity/client/ClientGrid";
import ClientEditView from "@/components/entity/client/ClientEditView";
import ClientDetailView from "@/components/entity/client/ClientDetailView";
import ClientDetailExtras from "@/components/entity/client/ClientDetailExtras";
import ContactEditView from "@/components/entity/contact/ContactEditView";
import AddressEditView from "@/components/entity/address/AddressEditView";
import {useContactReferenceField} from "@/hooks/useContactReferenceField";
import {useAddressReferenceField} from "@/hooks/useAddressReferenceField";

type EditingEntity =
  | { model: "Client"; data: Client; mode: "edit" | "create" }
  | { model: "Contact"; data: Contact; mode: "edit" | "create" }
  | { model: "Address"; data: Address; mode: "edit" | "create" };

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");

  const [item, setItem] = useState<Client | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();

  const [refreshContactsKey, setRefreshContactsKey] = useState(0);
  const [refreshAddressesKey, setRefreshAddressesKey] = useState(0);
  const [contactsForceLoading, setContactsForceLoading] = useState(false);
  const [addressesForceLoading, setAddressesForceLoading] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EditingEntity>();
  const finishModal = () => { setEditingEntity(undefined); closeModal(); };

  const { options: contactOptions, loading: loadingContacts, refetch: refetchContactOptions } = useContactReferenceField();
  const { options: addressOptions, loading: loadingAddresses, refetch: refetchAddressOptions } = useAddressReferenceField();

  const {
    items,
    page,
    pageSize,
    totalCount,
    loading,
    handlePageChange,
    refetch,
  } = usePaginatedEntityList<Client>({
    fetchPage: (skip, limit) => ClientsService.listItemsClientsGet(skip, limit),
    enabled: !id,
  });


  // Default new client template
  const defaultType = Object.values(ClientType)[0];
  const initialNewClient: Client = {
    name: "",
    code: "",
    type: defaultType as ClientType,
    description: "",
  };

  const initialNewContact: Contact = {
    name: "",
    title: "",
    email: "",
    phone: ""
  };

  const initialNewAddress: Address = {
    street: "",
    street2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "",
  };

  // Fetch list or single item based on 'id' query param
  useEffect(() => {
    setLoadingItems(true);
    const fetchData = async () => {
      try {
        if (id) {
          const data = await ClientsService.getItemClientsItemIdGet(id);
          setItem(data);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error(`Error fetching client data`);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRowClick = (rowId: string) => {
    router.push(`/clients?id=${rowId}`);
  };

  const handleNewClient = () => {
    setItem(initialNewClient);
    setEditingEntity({ model: "Client", data: initialNewClient, mode: "create" });
    openModal();
  };

  const handleNewContact = (prefill?: string) => {
    const contact: Contact = {
      ...initialNewContact,
      name: prefill ?? "",
    };
    setEditingEntity({ model: "Contact", data: contact, mode: "create" });
    openModal();
  };

  const handleNewAddress = (prefill?: string) => {
    const address: Address = {
      ...initialNewAddress,
      street: prefill ?? "",
    };
    setEditingEntity({ model: "Address", data: address, mode: "create" });
    openModal();
  };

  // Save changes: either create or update
  const handleSave = async (
      updatedItem: Client | Contact | Address,
      modelName: "Client" | "Contact" | "Address"
  ): Promise<void> => {
    if (!updatedItem) return;
    try {
      if (modelName === "Client") {
        const client = updatedItem as Client;
        if (client._id) {
          await ClientsService.updateItemClientsItemIdPut(client._id, client);
          const refreshed = await ClientsService.getItemClientsItemIdGet(client._id);
          setItem(refreshed);
        } else {
          const newItem = await ClientsService.createItemClientsPost(client);
          setItem(newItem);
          router.push(`/clients?id=${newItem._id}`);
        }
      }
      if (modelName === "Contact") {
        const contact = updatedItem as Contact;
        if (contact._id) {
          await ContactsService.updateItemContactsItemIdPut(contact._id, contact);
          setRefreshContactsKey(k => k + 1);
        } else {
          const saved = await ContactsService.createItemContactsPost(contact);
          if (item?._id) {
            const newIds = [...(item.contact_ids ?? []), String(saved._id)];
            await ClientsService.updateItemClientsItemIdPut(item._id, {
              ...item as Client,
              contact_ids: newIds,
            });
            setItem(prev => prev ? { ...prev, contact_ids: newIds } : prev);
          }
          refetchContactOptions();
        }
      }
      if (modelName === "Address") {
        const address = updatedItem as Address;
        if (address._id) {
          await AddressesService.updateItemAddressesItemIdPut(address._id, address);
          setRefreshAddressesKey(k => k + 1);
        } else {
          const saved = await AddressesService.createItemAddressesPost(address);
          if (item?._id) {
            const newIds = [...(item.address_ids ?? []), String(saved._id)];
            await ClientsService.updateItemClientsItemIdPut(item._id, {
              ...item as Client,
              address_ids: newIds,
            });
            setItem(prev => prev ? { ...prev, address_ids: newIds } : prev);
          }
          refetchAddressOptions();
        }
      }
      finishModal();
    } catch (error) {
      // Let 422 validation errors propagate to EntityEditView -> handleApiError
      const { status } = getApiErrorInfo(error);
      if (status !== 422) {
        console.error(`Failed to save ${modelName}:`, error);
        toast.error(`Failed to save ${modelName.toLowerCase()}`);
      }
      throw error;
    }
  };

  // Delete handler
  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    try {
      if (confirm(`Are you sure you want to delete this client?`)) {
        await ClientsService.deleteItemClientsItemIdDelete(rowId);
        refetch();
      }
    } catch (error) {
      console.error("Failed to delete client:", error);
      toast.error(`Failed to delete client`);
    }
  };

  // Show loading spinner
  if (loading || loadingItems) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  function handleEdit<T extends EditingEntity["model"]>(
    item: Extract<EditingEntity, { model: T }>["data"],
    modelName: T
  ) {
    setEditingEntity({ model: modelName, data: item, mode: "edit" } as Extract<EditingEntity, { model: T }>);
    openModal();
  }

  const handleAddContact = async (contactId: string) => {
    if (!item?._id) return;
    try {
      setContactsForceLoading(true);
      const newIds = [...(item.contact_ids ?? []), contactId];
      await ClientsService.updateItemClientsItemIdPut(String(item._id), {
        ...item as Client,
        contact_ids: newIds,
      });
      setItem((prev) =>
        prev ? { ...prev, contact_ids: newIds } : prev
      );
      setContactsForceLoading(false);
      toast.success("Contact added to client");
    } catch (err) {
      console.error("Failed to add contact:", err);
      toast.error("Failed to add contact");
    }
  };

  const handleRemoveContact = async (contact: Contact) => {
    if (!item?._id || !contact._id) return;
    try {
      setContactsForceLoading(true);
      const newIds = (item.contact_ids ?? []).filter((id) => id !== contact._id);
      await ClientsService.updateItemClientsItemIdPut(String(item._id), {
        ...item as Client,
        contact_ids: newIds,
      });
      setItem((prev) =>
        prev ? { ...prev, contact_ids: newIds } : prev
      );
      setContactsForceLoading(false);
      toast.success("Contact removed from client");
    } catch (err) {
      console.error("Failed to remove contact:", err);
      toast.error("Failed to remove contact");
    }
  };

  const handleAddAddress = async (addressId: string) => {
    if (!item?._id) return;
    try {
      setAddressesForceLoading(true);
      const newIds = [...(item.address_ids ?? []), addressId];
      await ClientsService.updateItemClientsItemIdPut(String(item._id), {
        ...item as Client,
        address_ids: newIds,
      });
      setItem((prev) =>
        prev ? { ...prev, address_ids: newIds } : prev
      );
      setAddressesForceLoading(false);
      toast.success("Address added to client");
    } catch (err) {
      console.error("Failed to add address:", err);
      toast.error("Failed to add address");
    }
  };

  const handleRemoveAddress = async (address: Address) => {
    if (!item?._id || !address._id) return;
    try {
      setAddressesForceLoading(true);
      const newIds = (item.address_ids ?? []).filter((id) => id !== address._id);
      await ClientsService.updateItemClientsItemIdPut(String(item._id), {
        ...item as Client,
        address_ids: newIds,
      });
      setItem((prev) =>
        prev ? { ...prev, address_ids: newIds } : prev
      );
      setAddressesForceLoading(false);
      // bumpRefreshKey();
      toast.success("Address removed from client");
    } catch (err) {
      console.error("Failed to remove address:", err);
      toast.error("Failed to remove address");
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <PageBreadcrumb
        items={
          id && item
            ? [
                { title: "Clients", route: "/clients" },
                { title: item.name || "<No Name>" },
              ]
            : [{ title: "Clients" }]
        }
      />

      {id && item ? (
        <>
          <ClientDetailView
            item={item}
            onEdit={() => handleEdit(item as Client, "Client")}
            detailExtras={(client) =>
              <ClientDetailExtras
                item={client}
                refreshContactsKey={refreshContactsKey}
                refreshAddressesKey={refreshAddressesKey}
                contactsForceLoading={contactsForceLoading}
                addressesForceLoading={addressesForceLoading}
                contactOptions={contactOptions}
                addressOptions={addressOptions}
                loadingContacts={loadingContacts}
                loadingAddresses={loadingAddresses}
                onEditContact={(contact) => handleEdit(contact, "Contact")}
                onEditAddress={(address) => handleEdit(address, "Address")}
                onAddContact={handleAddContact}
                onAddAddress={handleAddAddress}
                onRemoveContact={handleRemoveContact}
                onRemoveAddress={handleRemoveAddress}
                onNewContact={handleNewContact}
                onNewAddress={handleNewAddress}
              />
            }
          />

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {editingEntity?.model === "Client" && (
              <ClientEditView
                item={item as Client}
                onSubmit={(updated) => handleSave(updated, "Client")}
                onCancel={finishModal}
                mode={editingEntity.mode}
              />
            )}
            {editingEntity?.model === "Contact" && (
              <ContactEditView
                item={editingEntity.data as Contact}
                onSubmit={(updated) => handleSave(updated as Contact, "Contact")}
                onCancel={finishModal}
                mode={editingEntity.mode}
              />
            )}
            {editingEntity?.model === "Address" && (
              <AddressEditView
                item={editingEntity.data as Address}
                onSubmit={(updated) => handleSave(updated as Address, "Address")}
                onCancel={finishModal}
                mode={editingEntity.mode}
              />
            )}
          </Modal>
        </>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="outline" onClick={handleNewClient}>
              New Client
            </Button>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <ClientGrid
              rows={items}
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={handlePageChange}
              onRowClick={handleRowClick}
              onDelete={handleDelete}
            />
          </Box>

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <ClientEditView
                item={item}
                onSubmit={(updated) => handleSave(updated, "Client")}
                onCancel={closeModal}
                mode="create"
              />
            )}
          </Modal>
        </>
      )}
    </ThemeProvider>
  );
}
