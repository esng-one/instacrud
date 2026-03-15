//invitations/page.tsx

"use client";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircularProgress, Box, ThemeProvider } from "@mui/material";
import toast, { Toaster } from "react-hot-toast";
import { useModal } from "@/hooks/useModal";
import { usePaginatedEntityList } from "@/hooks/usePaginatedEntityList";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useTailwindMuiTheme } from "@/app/lib/util";

import { AdminService } from "@/api/services/AdminService";
import type { InvitationListResponse } from "@/api/models/InvitationListResponse";
import type { InviteUserCreate } from "@/api/models/InviteUserCreate";
import { Role } from "@/api/models/Role";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useTurnstileSettings } from "@/hooks/useTurnstileSettings";

import InvitationGrid from "@/components/entity/invitation/InvitationGrid";
import InvitationDetailView from "@/components/entity/invitation/InvitationDetailView";
import InvitationEditView from "@/components/entity/invitation/InvitationEditView";
import ReferenceSelector from "@/components/form/ReferenceSelector";
import { useOrganizationReferenceField } from "@/hooks/useOrganizationReferenceField";


export default function InvitationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");
  const { currentUser } = useCurrentUser();

  const [item, setItem] = useState<InvitationListResponse | InviteUserCreate | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  const prevOrgIdRef = useRef<string | null>(null);

  const {
    widget: turnstileWidget,
    canSubmit: turnstileCanSubmit,
    showVerifying,
    reset: resetTurnstile,
    token,
    effectiveTurnstileEnabled,
  } = useTurnstileSettings({ submitting });

  // Organization reference field
  const { options: organizationOptions, loading: organizationsLoading } = useOrganizationReferenceField();

  // Handler for organization selector change
  const handleOrganizationChange = (field: keyof any, value: string | number | null) => {
    setSelectedOrganizationId(value as string | null);
  };

  // Initialize organization selector with current user's organization
  useEffect(() => {
    if (currentUser?.organization_id && currentUser.organization_id.trim() !== 'None') {
      setSelectedOrganizationId(currentUser.organization_id);
    }
  }, [currentUser]);

  // Memoized fetch function that updates when selectedOrganizationId changes
  const fetchInvitations = useCallback((skip: number, limit: number) => {
    return AdminService.listInvitationsAdminInvitationsGet(selectedOrganizationId, skip, limit);
  }, [selectedOrganizationId]);

  const {
    items,
    page,
    pageSize,
    totalCount,
    loading,
    handlePageChange,
    refetch,
    setPage,
  } = usePaginatedEntityList<InvitationListResponse>({
    fetchPage: fetchInvitations,
    enabled: !id,
  });

  // Reset to first page when organization changes to trigger refetch
  useEffect(() => {
    // Only refetch if organization actually changed (not initial load)
    if (prevOrgIdRef.current !== selectedOrganizationId) {
      refetch();
    }
    prevOrgIdRef.current = selectedOrganizationId;
  }, [selectedOrganizationId, refetch]);

  // Default new invitation template - auto-fill organization_id based on selection
  const initialNewInvitation: InviteUserCreate = useMemo(() => {
    let defaultRole = Role.USER;
    if (!selectedOrganizationId) {
      // No organization selected
      if (currentUser?.role === "ADMIN") {
        defaultRole = Role.ADMIN; // ADMIN can invite ADMIN users
      } else {
        defaultRole = Role.USER; // ORG_ADMIN defaults to USER (though they can't assign ADMIN)
      }
    }
    
    return {
      email: "",
      role: defaultRole,
      organization_id: selectedOrganizationId || "",
    };
  }, [selectedOrganizationId, currentUser?.role]);

  // Fetch single invitation by ID (we need to find it from the list since there's no single get endpoint)
  useEffect(() => {
    setLoadingItems(true);
    const fetchData = async () => {
      try {
        if (id) {
          // Since there's no single invitation endpoint, we'll fetch the list and find the specific one
          const organizationId = selectedOrganizationId; // Use selected organization for filtering
          const allInvitations = await AdminService.listInvitationsAdminInvitationsGet(organizationId);
          const foundInvitation = allInvitations.find(invitation => invitation.id === id);
          
          if (foundInvitation) {
            setItem(foundInvitation);
          } else {
            toast.error("Invitation not found");
            router.push('/invitations');
          }
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch invitation data:", error);
        toast.error(`Error fetching invitation data`);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchData();
  }, [id, router, selectedOrganizationId]);

  const handleRowClick = useCallback((rowId: string) => {
    router.push(`/invitations?id=${rowId}`);
  }, [router]);

  const handleNew = useCallback(() => {
    setItem(initialNewInvitation);
    openModal();
  }, [initialNewInvitation, openModal]);

  // Save changes: create invitation
  const handleSave = useCallback(async (updatedItem: InviteUserCreate) => {
    if (!updatedItem) return;
    setSubmitting(true);
    try {
      await AdminService.inviteUserAdminInviteUserPost(updatedItem, token);
      toast.success("Invitation sent successfully!");
      closeModal();
      refetch();
      // After creation, redirect to invitations list
      router.push('/invitations');
    } catch (error) {
      console.error("Failed to save invitation:", error);
      toast.error(`Failed to send invitation`);
    } finally {
      setSubmitting(false);
      resetTurnstile();
    }
  }, [closeModal, refetch, router, token, resetTurnstile]);

  // Delete handler
  const handleDelete = useCallback(async (rowId: string) => {
    if (!rowId) return;
    try {
      await AdminService.deleteInvitationAdminInvitationsInvitationIdDelete(rowId);
      toast.success("Invitation deleted successfully!");
      refetch();
      // If we're currently viewing the deleted invitation, redirect to list
      if (id === rowId) {
        router.push('/invitations');
      }
    } catch (error) {
      console.error("Failed to delete invitation:", error);
      toast.error(`Failed to delete invitation`);
    }
  }, [refetch, router, id]);

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
      <Toaster position="top-right" />

      <PageBreadcrumb
        items={
          id && item && 'id' in item
            ? [
                { title: "Invitations", route: "/invitations" },
                { title: item.id || "<No ID>" },
              ]
            : [{ title: "Invitations" }]
        }
      />

      {id && item && 'id' in item ? (
        <>
          <InvitationDetailView 
            item={item} 
            // Invitations are typically not editable once created, so no onEdit handler
          />
        </>
      ) : (
        <>
          <div className={`flex items-center mb-4 ${currentUser?.role === Role.ADMIN ? 'justify-between' : 'justify-end'}`}>
            {/* Organization Selector - 1/3 width - Only visible for ADMIN users */}
            {currentUser?.role === Role.ADMIN && (
              <div className="w-1/3 relative">
                <ReferenceSelector
                  field="organization_id"
                  value={selectedOrganizationId}
                  options={organizationOptions}
                  loading={organizationsLoading}
                  onChange={handleOrganizationChange}
                />
                {!selectedOrganizationId && !organizationsLoading && organizationOptions.length > 0 && (
                  <div
                    className="absolute left-3 pointer-events-none text-gray-500 dark:text-gray-400"
                    style={{
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '14px',
                      zIndex: 1,
                      lineHeight: '1.4375em'
                    }}
                  >
                    Please select organization...
                  </div>
                )}
              </div>
            )}
            
            {/* Action button - right aligned */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleNew}>
                Send Invitation
              </Button>
            </div>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <InvitationGrid
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
            {item && 'email' in item && (
              <InvitationEditView
                item={item}
                onSubmit={handleSave}
                onCancel={closeModal}
                mode="create"
                selectedOrganizationId={selectedOrganizationId}
                canSubmit={turnstileCanSubmit}
                extraContent={
                  <>
                    {effectiveTurnstileEnabled && <div>{turnstileWidget}</div>}
                    {showVerifying && (
                      <span className="inline-block rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        Verifying…
                      </span>
                    )}
                  </>
                }
              />
            )}
          </Modal>
        </>
      )}
    </ThemeProvider>
  );
}
