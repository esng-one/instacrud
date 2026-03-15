///users/page.tsx

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
import type { UserResponse } from "@/api/models/UserResponse";
import type { UserUpdate } from "@/api/models/UserUpdate";
import type { UserCreate } from "@/api/models/UserCreate";
import type { InviteUserCreate } from "@/api/models/InviteUserCreate";
import { Role } from "@/api/models/Role";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useOrganizationReferenceField } from "@/hooks/useOrganizationReferenceField";
import { useTurnstileSettings } from "@/hooks/useTurnstileSettings";

import UserGrid from "@/components/entity/user/UserGrid";
import UserDetailView from "@/components/entity/user/UserDetailView";
import UserEditView from "@/components/entity/user/UserEditView";
import UserDeleteDialog from "@/components/entity/user/UserDeleteDialog";
import InvitationEditView from "@/components/entity/invitation/InvitationEditView";
import ReferenceSelector from "@/components/form/ReferenceSelector";

// Special value for "Global Administrators" option
const GLOBAL_ADMINS_VALUE = "__GLOBAL_ADMINS__";

export default function UsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const id = searchParams.get("id");
  const { currentUser } = useCurrentUser();

  const [item, setItem] = useState<UserResponse | UserCreate | null>(null);
  const [invitationItem, setInvitationItem] = useState<InviteUserCreate | null>(null);
  // Default to Global Administrators for admin users
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(GLOBAL_ADMINS_VALUE);
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  const { isOpen: isInviteOpen, openModal: openInviteModal, closeModal: closeInviteModal } = useModal();
  const { isOpen: isDeleteOpen, openModal: openDeleteModal, closeModal: closeDeleteModal } = useModal();
  const prevOrgIdRef = useRef<string | null>(null);

  const {
    widget: turnstileWidget,
    canSubmit: turnstileCanSubmit,
    showVerifying,
    reset: resetTurnstile,
    token,
    effectiveTurnstileEnabled,
  } = useTurnstileSettings({ submitting: inviteSubmitting });

  // Organization reference field
  const { options: organizationOptions, loading: organizationsLoading } = useOrganizationReferenceField();

  // Add "Global Administrators" as the first option for admin users
  const extendedOrganizationOptions = useMemo(() => {
    const globalAdminsOption = {
      value: GLOBAL_ADMINS_VALUE,
      label: "Global Administrators",
      original: null as any,
      hasDivider: true,
    };
    return [globalAdminsOption, ...organizationOptions];
  }, [organizationOptions]);

  // Handler for organization selector change
  const handleOrganizationChange = (field: keyof any, value: string | number | null) => {
    setSelectedOrganizationId(value as string | null);
  };

  // Get the actual organization ID to pass to the API (null for Global Administrators)
  const effectiveOrganizationId = selectedOrganizationId === GLOBAL_ADMINS_VALUE ? null : selectedOrganizationId;

  // Memoized fetch function that updates when selectedOrganizationId changes
  const fetchUsers = useCallback((skip: number, limit: number) => {
    return AdminService.listUsersAdminUsersGet(effectiveOrganizationId, skip, limit);
  }, [effectiveOrganizationId]);

  const {
    items,
    page,
    pageSize,
    totalCount,
    loading,
    handlePageChange,
    refetch,
    setPage,
  } = usePaginatedEntityList<UserResponse>({
    fetchPage: fetchUsers,
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

  // Default new user template - auto-fill organization_id based on selection
  const initialNewUser: UserCreate = useMemo(() => {
    let defaultRole = Role.USER;
    if (!effectiveOrganizationId) {
      // Global Administrators selected
      if (currentUser?.role === "ADMIN") {
        defaultRole = Role.ADMIN; // ADMIN can create ADMIN users
      } else {
        defaultRole = Role.USER; // ORG_ADMIN defaults to USER (though they can't assign ADMIN)
      }
    }

    return {
      email: "",
      name: "",
      password: "",
      role: defaultRole,
      organization_id: effectiveOrganizationId || "",
    };
  }, [effectiveOrganizationId, currentUser?.role]);

  // Default new invitation template - auto-fill organization_id based on selection
  const initialNewInvitation: InviteUserCreate = useMemo(() => {
    let defaultRole = Role.USER;
    if (!effectiveOrganizationId) {
      // Global Administrators selected
      if (currentUser?.role === "ADMIN") {
        defaultRole = Role.ADMIN; // ADMIN can invite ADMIN users
      } else {
        defaultRole = Role.USER; // ORG_ADMIN defaults to USER (though they can't assign ADMIN)
      }
    }

    return {
      email: "",
      role: defaultRole,
      organization_id: effectiveOrganizationId || "",
    };
  }, [effectiveOrganizationId, currentUser?.role]);

  // Fetch list or single item based on 'id' query param
  useEffect(() => {
    setLoadingItems(true);
    const fetchData = async () => {
      try {
        if (id) {
          const data = await AdminService.getUserAdminUsersUserIdGet(id);
          setItem(data);
        } else {
          setItem(null);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error(`Error fetching user data`);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRowClick = (rowId: string) => {
    router.push(`/users?id=${rowId}`);
  };

  const handleNew = () => {
    setItem(initialNewUser);
    openModal();
  };

  const handleInvite = () => {
    setInvitationItem(initialNewInvitation);
    openInviteModal();
  };

  // Save changes: either create or update
  const handleSave = async (updatedItem: UserCreate | UserUpdate) => {
    if (!updatedItem) return;
    try {
      if (item && 'id' in item && item.id) {
        // Update existing user
        await AdminService.updateUserAdminUsersUserIdPatch(item.id, updatedItem as UserUpdate);
        const refreshed = await AdminService.getUserAdminUsersUserIdGet(item.id);
        setItem(refreshed);
      } else {
        // Create new user
        await AdminService.addUserAdminAddUserPost(updatedItem as UserCreate);
        // After creation, redirect to users list and refetch
        router.push('/users');
      }
      closeModal();
      refetch();
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error(`Failed to save user`);
    }
  };

  // Save invitation
  const handleSaveInvitation = useCallback(async (updatedItem: InviteUserCreate) => {
    if (!updatedItem) return;
    setInviteSubmitting(true);
    try {
      await AdminService.inviteUserAdminInviteUserPost(updatedItem, token);
      toast.success("Invitation sent successfully!");
      closeInviteModal();
      refetch();
    } catch (error) {
      console.error("Failed to send invitation:", error);
      toast.error(`Failed to send invitation`);
    } finally {
      setInviteSubmitting(false);
      resetTurnstile();
    }
  }, [closeInviteModal, refetch, token, resetTurnstile]);

  // Delete handler - shows confirmation dialog
  const handleDelete = async (rowId: string) => {
    if (!rowId) return;
    
    // Find the user to delete from the items list
    const userToDelete = items.find(user => user.id === rowId);
    if (!userToDelete) {
      toast.error("User not found");
      return;
    }
    
    setUserToDelete(userToDelete);
    openDeleteModal();
  };

  // Handle successful deletion from dialog
  const handleDeleteSuccess = () => {
    refetch();
    // If we're currently viewing the deleted user, redirect to list
    if (id && userToDelete && id === userToDelete.id) {
      router.push('/users');
    }
    setUserToDelete(null);
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
      <Toaster position="top-right" />

      <PageBreadcrumb
        items={
          id && item && 'email' in item
            ? [
                { title: "Users", route: "/users" },
                { title: item.email || "<No Email>" },
              ]
            : [{ title: "Users" }]
        }
      />

      {id && item && 'id' in item ? (
        <>
          <UserDetailView item={item} onEdit={openModal} />

          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
            {item && (
              <UserEditView
                item={item}
                onSubmit={handleSave}
                onCancel={closeModal}
                mode="edit"
                selectedOrganizationId={effectiveOrganizationId}
              />
            )}
          </Modal>
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
                  options={extendedOrganizationOptions}
                  loading={organizationsLoading}
                  onChange={handleOrganizationChange}
                  required
                />
              </div>
            )}
            
            {/* Action buttons - right aligned */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleInvite}>
                Invite User
              </Button>
              <Button size="sm" variant="outline" onClick={handleNew}>
                New User
              </Button>
            </div>
          </div>

          <Box sx={{ height: 600, width: "100%" }}>
            <UserGrid
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
              <UserEditView
                item={item}
                onSubmit={handleSave}
                onCancel={closeModal}
                mode="create"
                selectedOrganizationId={effectiveOrganizationId}
              />
            )}
          </Modal>

          <Modal isOpen={isInviteOpen} onClose={closeInviteModal} className="max-w-[700px] m-4">
            {invitationItem && (
              <InvitationEditView
                item={invitationItem}
                onSubmit={handleSaveInvitation}
                onCancel={closeInviteModal}
                mode="create"
                selectedOrganizationId={effectiveOrganizationId}
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

          {/* User Delete Confirmation Dialog */}
          {userToDelete && (
            <UserDeleteDialog
              isOpen={isDeleteOpen}
              onClose={closeDeleteModal}
              user={userToDelete}
              onDeleteSuccess={handleDeleteSuccess}
            />
          )}
        </>
      )}
    </ThemeProvider>
  );
}
