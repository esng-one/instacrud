// components/entity/EntityLayout.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircularProgress, Box, ThemeProvider } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { EntityGrid } from "@/components/entity/EntityGrid";
import { EntityDetailView } from "@/components/entity/EntityDetailView";
import { EntityEditView } from "@/components/entity/EntityEditView";
import { getApiErrorDetail } from "@/app/lib/api-error";
import { useTailwindMuiTheme } from "@/app/lib/util";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import toast from "react-hot-toast";
import { useModal } from "@/hooks/useModal";
import PageBreadcrumb from "../common/PageBreadCrumb";

type DetailField<T> = {
  label: string;
  field: keyof T;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
};

type EditField<T> = {
  label: string;
  field: keyof T;
  type: "text" | "select";
  options?: (string | number)[];
  render?: (value: string | number | boolean, item: T) => React.ReactNode;
};

interface EntityLayoutProps<T> {
  service: {
    list: (skip?: number, limit?: number, filters?: unknown) => Promise<T[]>;
    get: (id: string) => Promise<T>;
    create: (item: T) => Promise<T>;
    update: (id: string, item: T) => Promise<T>;
    delete: (id: string) => Promise<void>;
  };
  columns: GridColDef[];
  detailFields: DetailField<T>[];
  formFields: EditField<T>[];
  modelName: string;
  basePath: string;
  idKey: keyof T;
  initialNewItem: T;
  detailExtras?: (item: T) => React.ReactNode;
}

/**
 * Generic layout component for CRUD pages.
 * Uses provided service and config to fetch data and render either a grid or a detail view.
 */
export function EntityLayout<T extends Record<string, unknown>>({
  service,
  columns,
  detailFields,
  formFields,
  modelName,
  basePath,
  idKey,
  initialNewItem,
  detailExtras,
}: EntityLayoutProps<T>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");

  const [items, setItems] = useState<T[]>([]);
  const [item, setItem] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOpen, openModal, closeModal } = useModal();

  // Fetch data whenever the 'id' query param changes.
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        if (id) {
          const data = await service.get(id);
          setItem(data);
        } else {
          const data = await service.list(0, 20);
          setItems(data);
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error(`Error fetching ${modelName.toLowerCase()} data`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRowClick = (rowId: string) => {
    router.push(`${basePath}?id=${rowId}`);
  };

  const handleNew = () => {
    setItem(initialNewItem);
    openModal();
  };

  const handleSave = async (updatedItem: T) => {
    if (!updatedItem) return;
    setItem(updatedItem);
    try {
      if (updatedItem[idKey] && typeof updatedItem[idKey] === "string") {
        // Update existing item
        await service.update(updatedItem[idKey], updatedItem);
      } else {
        // Create new item
        const newItem = await service.create(updatedItem);
        router.push(`${basePath}?id=${newItem[idKey]}`);
      }
      closeModal();
    } catch (error) {
      console.error("Failed to save changes:", error);
      toast.error(getApiErrorDetail(error) as string);
    }
  };

  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    try {
      if (confirm(`Are you sure you want to delete this ${modelName.toLowerCase()}?`)) {
        await service.delete(rowId);
        // Refresh list after deletion
        const data = await service.list(0, 20);
        setItems(data);
      }
    } catch (error) {
      console.error(`Failed to delete ${modelName.toLowerCase()}:`, error);
      toast.error(`Failed to delete ${modelName.toLowerCase()}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  // If we have an ID and an item loaded, show the detail view.
  if (id && item) {
    return (
      <ThemeProvider theme={theme}>
        <PageBreadcrumb
            items={[{ title: "Clients", route: "/clients" }, { title: item.name as string }]}
        />
        <EntityDetailView
          item={item}
          fields={detailFields}
          onEdit={openModal}
          detailExtras={detailExtras}
          modelName={modelName}
        />
        <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
          {item && (
            <EntityEditView
              item={item}
              fields={formFields}
              onSubmit={handleSave}
              onCancel={closeModal}
              mode="edit"
              modelName={modelName}
            />
          )}
        </Modal>
      </ThemeProvider>
    );
  }

  // Otherwise, show the grid view with a "New" button.
  return (
    <ThemeProvider theme={theme}>
      <PageBreadcrumb items={[{ title: `${modelName}s` }]} />
      <div className="flex justify-end mb-4">
        <Button size="sm" variant="outline" onClick={handleNew}>
          New {modelName}
        </Button>
      </div>
      <Box sx={{ height: 600, width: "100%" }}>
        <EntityGrid
          rows={items}
          columns={columns}
          idKey={idKey}
          onRowClick={handleRowClick}
          onDelete={handleDelete}
        />
      </Box>
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        {item && (
          <EntityEditView
            item={item}
            fields={formFields}
            onSubmit={handleSave}
            onCancel={closeModal}
            mode="create"
            modelName={modelName}
          />
        )}
      </Modal>
    </ThemeProvider>
  );
}
