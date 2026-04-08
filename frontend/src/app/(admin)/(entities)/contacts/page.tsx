// contacts/page.tsx

"use client";
import { useEffect, useState } from "react";
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

import { ContactsService } from "@/api/services/ContactsService";
import type { Contact_Input as Contact } from "@/api/models/Contact_Input";

import ContactGrid from "@/components/entity/contact/ContactGrid";
import ContactDetailView from "@/components/entity/contact/ContactDetailView";
import ContactEditView from "@/components/entity/contact/ContactEditView";

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");

  const [item, setItem] = useState<Contact | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();

  const {
    items,
    page,
    pageSize,
    totalCount,
    loading,
    handlePageChange,
    refetch,
  } = usePaginatedEntityList<Contact>({
    fetchPage: (skip, limit) => ContactsService.listItemsContactsGet(skip, limit),
    enabled: !id,
  });

  // Default new contact template
  const initialNewContact: Contact = {
    name: "",
    title: "",
    email: "",
    phone: "",
  };

  useEffect(() => {
    setLoadingItems(true);
    const fetchData = async () => {
      try {
        if (id) {
          const data = await ContactsService.getItemContactsItemIdGet(id);
          setItem(data);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error(`Error fetching contact data`);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRowClick = (rowId: string) => {
    router.push(`/contacts?id=${rowId}`);
  };

  const handleNew = () => {
    setItem(initialNewContact);
    openModal();
  };

  // Save changes: either create or update
  const handleSave = async (updatedItem: Contact) => {
    if (!updatedItem) return;
    try {
      if (updatedItem._id) {
        await ContactsService.updateItemContactsItemIdPut(updatedItem._id, updatedItem);
        const refreshed = await ContactsService.getItemContactsItemIdGet(updatedItem._id);
        setItem(refreshed);
      } else {
        const newItem = await ContactsService.createItemContactsPost(updatedItem);
        setItem(newItem);
        router.push(`/contacts?id=${newItem._id}`);
      }
      toast.success("Contact saved successfully!");
      closeModal();
    } catch (error) {
      // Let 422 validation errors propagate to EntityEditView -> handleApiError
      const { status } = getApiErrorInfo(error);
      if (status !== 422) {
        console.error("Failed to save contact:", error);
        toast.error(`Failed to save contact`);
      }
      throw error;
    }

  };

  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    try {
      if (confirm(`Are you sure you want to delete this contact?`)) {
        await ContactsService.deleteItemContactsItemIdDelete(rowId);
        refetch();
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
      toast.error("Failed to delete contact");
    }
  };

  if (loading || loadingItems) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <PageBreadcrumb
        items={
          id && item
            ? [
                { title: "Contacts", route: "/contacts" },
                { title: item.name || "<No Name>" },
              ]
            : [{ title: "Contacts" }]
        }
      />

      {id && item ? (
        <>
          <ContactDetailView item={item} onEdit={openModal} />

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <ContactEditView
                item={item}
                onSubmit={handleSave}
                onCancel={closeModal}
                mode="edit"
              />
            )}
          </Modal>
        </>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="outline" onClick={handleNew}>
              New Contact
            </Button>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <ContactGrid
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
              <ContactEditView
                item={item}
                onSubmit={handleSave}
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