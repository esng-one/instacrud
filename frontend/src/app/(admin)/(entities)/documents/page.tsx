///documents/page.tsx

"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircularProgress, Box, ThemeProvider } from "@mui/material";
import toast from "react-hot-toast";
import { useModal } from "@/hooks/useModal";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useTailwindMuiTheme } from "@/app/lib/util";
import { getApiErrorInfo } from "@/app/lib/api-error";

import { DocumentsService } from "@/api/services/DocumentsService";
import type { ProjectDocument_Input as ProjectDocument } from "@/api/models/ProjectDocument_Input";

import DocumentGrid from "@/components/entity/document/DocumentGrid";
import DocumentDetailView from "@/components/entity/document/DocumentDetailView";
import DocumentEditView from "@/components/entity/document/DocumentEditView";

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");

  const [item, setItem] = useState<ProjectDocument | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();

  const {
    items,
    loading,
    hasMore,
    initialLoading,
    lastElementRef,
    refetch,
  } = useInfiniteScroll<ProjectDocument>({
    fetchPage: (skip, limit) => DocumentsService.listItemsDocumentsGet(skip, limit),
    pageSize: 10,
  });

  // Default new document template
  const initialNewDocument: ProjectDocument = {
    project_id: "",
    code: "",
    name: "",
    description: "",
    content: "",
  };

  // Fetch list or single item based on 'id' query param
  useEffect(() => {
    setLoadingItems(true);
    const fetchData = async () => {
      try {
        if (id) {
          const data = await DocumentsService.getItemDocumentsItemIdGet(id);
          setItem(data);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error(`Error fetching document data`);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRowClick = (rowId: string) => {
    router.push(`/documents?id=${rowId}`);
  };

  const handleNew = () => {
    setItem(initialNewDocument);
    openModal();
  };

  // Save changes: either create or update
  const handleSave = async (updatedItem: ProjectDocument) => {
    if (!updatedItem) return;
    try {
      if (updatedItem._id) {
        await DocumentsService.updateItemDocumentsItemIdPut(updatedItem._id, updatedItem);
        const refreshed = await DocumentsService.getItemDocumentsItemIdGet(updatedItem._id);
        setItem(refreshed);
        refetch();
      } else {
        const newItem = await DocumentsService.createItemDocumentsPost(updatedItem);
        setItem(newItem);
        router.push(`/documents?id=${newItem._id}`);
      }
      closeModal();
    } catch (error) {
      // Let 422 validation errors propagate to EntityEditView -> handleApiError
      const { status } = getApiErrorInfo(error);
      if (status !== 422) {
        console.error("Failed to save:", error);
        toast.error(`Failed to save document`);
      }
      throw error;
    }
  };

  // Delete handler
  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    try {
      if (confirm(`Are you sure you want to delete this document?`)) {
        await DocumentsService.deleteItemDocumentsItemIdDelete(rowId);
        refetch();
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error(`Failed to delete document`);
    }
  };

  // Show loading spinner for initial load
  if (initialLoading || loadingItems) {
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
                { title: "Documents", route: "/documents" },
                { title: item.name || "<No Name>" },
              ]
            : [{ title: "Documents" }]
        }
      />

      {id && item ? (
        <>
          <DocumentDetailView item={item} onEdit={openModal} />

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <DocumentEditView
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
              New Document
            </Button>
          </div>

          <Box sx={{ width: "100%" }}>
            <DocumentGrid
              rows={items}
              onRowClick={handleRowClick}
              onDelete={handleDelete}
              loading={loading}
              hasMore={hasMore}
              lastElementRef={lastElementRef}
            />
          </Box>

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <DocumentEditView
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
