///addresses/page.tsx

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

import { AddressesService } from "@/api/services/AddressesService";
import type { Address_Input as Address } from "@/api/models/Address_Input";

import AddressGrid from "@/components/entity/address/AddressGrid";
import AddressDetailView from "@/components/entity/address/AddressDetailView";
import AddressEditView from "@/components/entity/address/AddressEditView";

export default function AddressesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");

  const [item, setItem] = useState<Address | null>(null);
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
  } = usePaginatedEntityList<Address>({
    fetchPage: (skip, limit) => AddressesService.listItemsAddressesGet(skip, limit),
    enabled: !id,
  });

  // Default new address template
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
          const data = await AddressesService.getItemAddressesItemIdGet(id);
          setItem(data);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error(`Error fetching address data`);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRowClick = (rowId: string) => {
    router.push(`/addresses?id=${rowId}`);
  };

  const handleNew = () => {
    setItem(initialNewAddress);
    openModal();
  };

  // Save changes: either create or update
  const handleSave = async (updatedItem: Address) => {
    if (!updatedItem) return;
    try {
      if (updatedItem._id) {
        await AddressesService.updateItemAddressesItemIdPut(updatedItem._id, updatedItem);
        const refreshed = await AddressesService.getItemAddressesItemIdGet(updatedItem._id);
        setItem(refreshed);
      } else {
        const newItem = await AddressesService.createItemAddressesPost(updatedItem);
        setItem(newItem);
        router.push(`/addresses?id=${newItem._id}`);
      }
      closeModal();
    } catch (error) {
      // Let 422 validation errors propagate to EntityEditView -> handleApiError
      const { status } = getApiErrorInfo(error);
      if (status !== 422) {
        console.error("Failed to save:", error);
        toast.error(`Failed to save address`);
      }
      throw error;
    }
  };

  // Delete handler
  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    try {
      if (confirm(`Are you sure you want to delete this address?`)) {
        await AddressesService.deleteItemAddressesItemIdDelete(rowId);
        refetch();
      }
    } catch (error) {
      console.error("Failed to delete address:", error);
      toast.error(`Failed to delete address`);
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

  return (
    <ThemeProvider theme={theme}>
      <PageBreadcrumb
        items={
          id && item
            ? [
                { title: "Addresses", route: "/addresses" },
                { title: item.street || "<No Street>" },
              ]
            : [{ title: "Addresses" }]
        }
      />

      {id && item ? (
        <>
          <AddressDetailView item={item} onEdit={openModal} />

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <AddressEditView
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
              New Address
            </Button>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <AddressGrid
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
              <AddressEditView
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
