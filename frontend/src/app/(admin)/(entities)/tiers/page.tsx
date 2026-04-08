//tiers/page.tsx

"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircularProgress, Box, ThemeProvider } from "@mui/material";
import toast, { Toaster } from "react-hot-toast";
import { useModal } from "@/hooks/useModal";
import { usePaginatedEntityList } from "@/hooks/usePaginatedEntityList";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useTailwindMuiTheme } from "@/app/lib/util";

import useUserRole from "@/hooks/useUserRole";
import { TiersService } from "@/api/services/TiersService";
import type { Tier_Input as Tier } from "@/api/models/Tier_Input";

import TierGrid from "@/components/entity/tier/TierGrid";
import TierDetailView from "@/components/entity/tier/TierDetailView";
import TierEditView from "@/components/entity/tier/TierEditView";

export default function TiersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const id = searchParams.get("id");

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, roleLoading, router]);

  const [item, setItem] = useState<Tier | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch function for paginated list
  const fetchTiers = useCallback((skip: number, limit: number) => {
    return TiersService.listItemsAdminTiersGet(skip, limit);
  }, []);

  const {
    items,
    page,
    pageSize,
    totalCount,
    loading,
    handlePageChange,
    refetch,
  } = usePaginatedEntityList<Tier>({
    fetchPage: fetchTiers,
    enabled: !id,
  });

  // Default new Tier template
  const initialNewTier: Tier = {
    tier: 0,
    name: "",
    code: "",
  };

  // Fetch single Tier by ID
  useEffect(() => {
    setLoadingItem(true);
    const fetchData = async () => {
      try {
        if (id) {
          const fetchedItem = await TiersService.getItemAdminTiersItemIdGet(id);
          setItem(fetchedItem);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch Tier data:", error);
        toast.error(`Error fetching Tier data`);
        router.push('/tiers');
      } finally {
        setLoadingItem(false);
      }
    };
    fetchData();
  }, [id, router]);

  const handleRowClick = useCallback((rowId: string) => {
    router.push(`/tiers?id=${rowId}`);
  }, [router]);

  const handleNew = useCallback(() => {
    setItem(initialNewTier);
    setIsEditing(false);
    openModal();
  }, [openModal]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    openModal();
  }, [openModal]);

  // Save changes: create or update Tier
  const handleSave = useCallback(async (updatedItem: Tier) => {
    if (!updatedItem) return;
    try {
      if (updatedItem._id) {
        // Update existing
        await TiersService.updateItemAdminTiersItemIdPut(updatedItem._id, updatedItem);
        toast.success("Tier updated successfully!");
      } else {
        // Create new
        await TiersService.createItemAdminTiersPost(updatedItem);
        toast.success("Tier created successfully!");
      }
      closeModal();
      refetch();
      // After creation/update, redirect to list
      router.push('/tiers');
    } catch (error) {
      console.error("Failed to save Tier:", error);
      toast.error(`Failed to save Tier`);
    }
  }, [closeModal, refetch, router]);

  // Delete handler
  const handleDelete = useCallback(async (rowId: string) => {
    if (!rowId) return;
    try {
      await TiersService.deleteItemAdminTiersItemIdDelete(rowId);
      toast.success("Tier deleted successfully!");
      refetch();
      // If we're currently viewing the deleted item, redirect to list
      if (id === rowId) {
        router.push('/tiers');
      }
    } catch (error) {
      console.error("Failed to delete Tier:", error);
      toast.error(`Failed to delete Tier`);
    }
  }, [refetch, router, id]);

  // Show loading spinner
  if (roleLoading || (!isAdmin && !roleLoading)) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  if (loading || loadingItem) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Toaster position="top-right" />

      <PageBreadcrumb
        items={
          id && item && item._id
            ? [
                { title: "Tiers", route: "/tiers" },
                { title: item.name || "<No Name>" },
              ]
            : [{ title: "Tiers" }]
        }
      />

      {id && item && item._id ? (
        <>
          <TierDetailView
            item={item}
            onEdit={handleEdit}
            onDelete={() => handleDelete(item._id!)}
          />
        </>
      ) : (
        <>
          <div className="flex justify-end items-center mb-4">
            <Button size="sm" variant="outline" onClick={handleNew}>
              Create Tier
            </Button>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <TierGrid
              rows={items}
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={handlePageChange}
              onRowClick={handleRowClick}
              onDelete={handleDelete}
            />
          </Box>
        </>
      )}

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        {item && (
          <TierEditView
            item={item}
            onSubmit={handleSave}
            onCancel={closeModal}
            mode={item._id ? "edit" : "create"}
          />
        )}
      </Modal>
    </ThemeProvider>
  );
}
