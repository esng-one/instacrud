///organizations/page.tsx

"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircularProgress, Box, ThemeProvider } from "@mui/material";
import toast, { Toaster } from "react-hot-toast";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useTailwindMuiTheme } from "@/app/lib/util";

import useUserRole from "@/hooks/useUserRole";
import { AdminService } from "@/api/services/AdminService";
import type { OrganizationResponse } from "@/api/models/OrganizationResponse";
import type { OrganizationCreate } from "@/api/models/OrganizationCreate";
import type { OrganizationUpdate } from "@/api/models/OrganizationUpdate";

import OrganizationGrid from "@/components/entity/organization/OrganizationGrid";
import OrganizationDetailView from "@/components/entity/organization/OrganizationDetailView";
import OrganizationEditView from "@/components/entity/organization/OrganizationEditView";
import OrganizationDeleteDialog from "@/components/entity/organization/OrganizationDeleteDialog";

export default function OrganizationsPage() {
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

  const [item, setItem] = useState<OrganizationResponse | OrganizationCreate | null>(null);
  const [items, setItems] = useState<OrganizationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [organizationToDelete, setOrganizationToDelete] = useState<OrganizationResponse | null>(null);

  // Pagination state (simplified for non-paginated API)
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [displayItems, setDisplayItems] = useState<OrganizationResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Default new organization template
  const initialNewOrganization: OrganizationCreate = {
    name: "",
    code: "",
    description: "",
  };

  // Fetch all organizations
  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const data = await AdminService.listOrganizationsAdminOrganizationsGet();
      setItems(data);
      setTotalCount(data.length);
      
      // Handle client-side pagination
      const startIndex = page * pageSize;
      const endIndex = startIndex + pageSize;
      setDisplayItems(data.slice(startIndex, endIndex));
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      toast.error("Error fetching organizations");
    } finally {
      setLoading(false);
    }
  };

  // Update display items when page or pageSize changes
  useEffect(() => {
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    setDisplayItems(items.slice(startIndex, endIndex));
  }, [items, page, pageSize]);

  // Fetch list or single item based on 'id' query param
  useEffect(() => {
    if (id) {
      setLoadingItems(true);
      const fetchSingleOrganization = async () => {
        try {
          const data = await AdminService.getOrganizationAdminOrganizationsOrganizationIdGet(id);
          setItem(data);
        } catch (error) {
          console.error("Failed to fetch organization:", error);
          toast.error("Error fetching organization data");
        } finally {
          setLoadingItems(false);
        }
      };
      fetchSingleOrganization();
    } else {
      setItem(null);
      fetchOrganizations();
    }
  }, [id, page, pageSize]);

  const handleRowClick = (rowId: string) => {
    router.push(`/organizations?id=${rowId}`);
  };

  const handleNew = () => {
    setItem(initialNewOrganization);
    openModal();
  };

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  // Save changes: either create or update
  const handleSave = async (updatedItem: OrganizationResponse | OrganizationCreate) => {
    if (!updatedItem) return;
    try {
      if ('id' in updatedItem && updatedItem.id) {
        // Update existing organization
        const updateData: OrganizationUpdate = {
          name: updatedItem.name,
          description: updatedItem.description,
          tier_id: (updatedItem as OrganizationResponse).tier_id,
          local_only_conversations: (updatedItem as OrganizationResponse).local_only_conversations,
        };
        const updated = await AdminService.updateOrganizationAdminOrganizationsOrganizationIdPatch(
          updatedItem.id,
          updateData
        );
        setItem(updated);
        toast.success("Organization updated successfully");
      } else {
        // Create new organization
        const createData: OrganizationCreate = {
          name: updatedItem.name,
          code: (updatedItem as OrganizationCreate).code,
          description: updatedItem.description,
          tier_id: (updatedItem as OrganizationCreate).tier_id,
        };
        await AdminService.onboardOrganizationAdminOrganizationsPost(createData);
        toast.success("Organization created successfully");
        // Refresh the list and navigate to the list view
        fetchOrganizations();
        router.push("/organizations");
      }
      closeModal();
    } catch (error) {
      console.error("Failed to save organization:", error);
      toast.error("Failed to save organization");
    }
  };

  // Delete handler
  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    const organization = items.find(item => item.id === rowId);
    if (organization) {
      setOrganizationToDelete(organization);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteSuccess = () => {
    fetchOrganizations();
    setDeleteDialogOpen(false);
    setOrganizationToDelete(null);
  };

  // Show loading spinner
  if (roleLoading || (!isAdmin && !roleLoading)) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  if (loading || loadingItems) {
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
          id && item && 'name' in item
            ? [
                { title: "Organizations", route: "/organizations" },
                { title: item.name || "<No Name>" },
              ]
            : [{ title: "Organizations" }]
        }
      />

      {id && item && 'id' in item ? (
        <>
          <OrganizationDetailView item={item as OrganizationResponse} onEdit={openModal} />

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <OrganizationEditView
                item={item}
                onSubmit={handleSave}
                onCancel={closeModal}
                mode="edit"
              />
            )}
          </Modal>

          {/* Delete Confirmation Dialog */}
          {organizationToDelete && (
            <OrganizationDeleteDialog
              isOpen={deleteDialogOpen}
              onClose={() => setDeleteDialogOpen(false)}
              organization={organizationToDelete}
              onDeleteSuccess={handleDeleteSuccess}
            />
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="outline" onClick={handleNew}>
              New Organization
            </Button>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <OrganizationGrid
              rows={displayItems}
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
              <OrganizationEditView
                item={item}
                onSubmit={handleSave}
                onCancel={closeModal}
                mode="create"
              />
            )}
          </Modal>

          {/* Delete Confirmation Dialog */}
          {organizationToDelete && (
            <OrganizationDeleteDialog
              isOpen={deleteDialogOpen}
              onClose={() => setDeleteDialogOpen(false)}
              organization={organizationToDelete}
              onDeleteSuccess={handleDeleteSuccess}
            />
          )}
        </>
      )}
    </ThemeProvider>
  );
}
