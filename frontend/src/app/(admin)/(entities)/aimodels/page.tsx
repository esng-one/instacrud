//aimodels/page.tsx

"use client";
import React, { useEffect, useState, useCallback } from "react";
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
import { AiModelsService } from "@/api/services/AiModelsService";
import type { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";

import AiModelGrid from "@/components/entity/aimodel/AiModelGrid";
import AiModelDetailView from "@/components/entity/aimodel/AiModelDetailView";
import AiModelEditView from "@/components/entity/aimodel/AiModelEditView";

export default function AiModelsPage() {
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

  const [item, setItem] = useState<AiModel | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  const [isEditing, setIsEditing] = useState(false);

  // Fetch function for paginated list
  const fetchAiModels = useCallback((skip: number, limit: number) => {
    return AiModelsService.listItemsAdminAiModelsGet(skip, limit);
  }, []);

  const {
    items,
    page,
    pageSize,
    totalCount,
    loading,
    handlePageChange,
    refetch,
  } = usePaginatedEntityList<AiModel>({
    fetchPage: fetchAiModels,
    enabled: !id,
  });

  // Default new AI Model template
  const initialNewAiModel: AiModel = {
    service: "OPEN_AI" as any,
    name: "",
    model_identifier: "",
  };

  // Fetch single AI Model by ID
  useEffect(() => {
    setLoadingItem(true);
    const fetchData = async () => {
      try {
        if (id) {
          const fetchedItem = await AiModelsService.getItemAdminAiModelsItemIdGet(id);
          setItem(fetchedItem);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch AI Model data:", error);
        toast.error(`Error fetching AI Model data`);
        router.push('/aimodels');
      } finally {
        setLoadingItem(false);
      }
    };
    fetchData();
  }, [id, router]);

  const handleRowClick = useCallback((rowId: string) => {
    router.push(`/aimodels?id=${rowId}`);
  }, [router]);

  const handleNew = useCallback(() => {
    setItem(initialNewAiModel);
    setIsEditing(false);
    openModal();
  }, [openModal]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    openModal();
  }, [openModal]);

  // Save changes: create or update AI Model
  const handleSave = useCallback(async (updatedItem: AiModel) => {
    if (!updatedItem) return;
    try {
      if (updatedItem._id) {
        // Update existing
        await AiModelsService.updateItemAdminAiModelsItemIdPut(updatedItem._id, updatedItem);
        toast.success("AI Model updated successfully!");
      } else {
        // Create new
        await AiModelsService.createItemAdminAiModelsPost(updatedItem);
        toast.success("AI Model created successfully!");
      }
      closeModal();
      refetch();
      // After creation/update, redirect to list
      router.push('/aimodels');
    } catch (error) {
      console.error("Failed to save AI Model:", error);
      toast.error(`Failed to save AI Model`);
    }
  }, [closeModal, refetch, router]);

  // Delete handler
  const handleDelete = useCallback(async (rowId: string) => {
    if (!rowId) return;
    try {
      await AiModelsService.deleteItemAdminAiModelsItemIdDelete(rowId);
      toast.success("AI Model deleted successfully!");
      refetch();
      // If we're currently viewing the deleted item, redirect to list
      if (id === rowId) {
        router.push('/aimodels');
      }
    } catch (error) {
      console.error("Failed to delete AI Model:", error);
      toast.error(`Failed to delete AI Model`);
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
                { title: "AI Models", route: "/aimodels" },
                { title: item.name || "<No Name>" },
              ]
            : [{ title: "AI Models" }]
        }
      />

      {id && item && item._id ? (
        <>
          <AiModelDetailView
            item={item}
            onEdit={handleEdit}
            onDelete={() => handleDelete(item._id!)}
          />
        </>
      ) : (
        <>
          <div className="flex justify-end items-center mb-4">
            <Button size="sm" variant="outline" onClick={handleNew}>
              Create AI Model
            </Button>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <AiModelGrid
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
          <AiModelEditView
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
