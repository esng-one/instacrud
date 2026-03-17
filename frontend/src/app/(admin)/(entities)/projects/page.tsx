// projects/page.tsx

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

import { ProjectsService } from "@/api/services/ProjectsService";
import type { Project_Input as Project } from "@/api/models/Project_Input";

import ProjectGrid from "@/components/entity/project/ProjectGrid";
import ProjectDetailView from "@/components/entity/project/ProjectDetailView";
import ProjectEditView from "@/components/entity/project/ProjectEditView";

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");

  const [item, setItem] = useState<Project | null>(null);
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
  } = usePaginatedEntityList<Project>({
    fetchPage: (skip, limit) => ProjectsService.listItemsProjectsGet(skip, limit),
    enabled: !id,
  });

  const initialNewProject: Project = {
    name: "",
    code: "",
    client_id: "",
    start_date: new Date().toISOString().split("T")[0],
    description: "",
  };

  useEffect(() => {
    setLoadingItems(true);
    const fetchData = async () => {
      try {
        if (id) {
          const data = await ProjectsService.getItemProjectsItemIdGet(id);
          setItem(data);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Error fetching project data");
      } finally {
        setLoadingItems(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRowClick = (rowId: string) => {
    router.push(`/projects?id=${rowId}`);
  };

  const handleNew = () => {
    setItem(initialNewProject);
    openModal();
  };

  // Save changes: either create or update
  const handleSave = async (updatedItem: Project) => {
    if (!updatedItem) return;
    try {
      if (updatedItem._id) {
        await ProjectsService.updateItemProjectsItemIdPut(updatedItem._id, updatedItem);
        const refreshed = await ProjectsService.getItemProjectsItemIdGet(updatedItem._id);
        setItem(refreshed);
      } else {
        const newItem = await ProjectsService.createItemProjectsPost(updatedItem);
        setItem(newItem);
        router.push(`/projects?id=${newItem._id}`);
      }
      closeModal();
    } catch (error) {
      // Let 422 validation errors propagate to EntityEditView -> handleApiError
      const { status } = getApiErrorInfo(error);
      if (status !== 422) {
        console.error("Failed to save:", error);
        toast.error(`Failed to save project`);
      }
      throw error;
    }
  };

  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    try {
      if (confirm("Are you sure you want to delete this project?")) {
        await ProjectsService.deleteItemProjectsItemIdDelete(rowId);
        refetch();
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
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
                { title: "Projects", route: "/projects" },
                { title: item.name || "<No Name>" },
              ]
            : [{ title: "Projects" }]
        }
      />

      {id && item ? (
        <>
          <ProjectDetailView item={item} onEdit={openModal} />

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <ProjectEditView
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
              New Project
            </Button>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <ProjectGrid 
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
              <ProjectEditView
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
