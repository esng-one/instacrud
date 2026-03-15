//components/entity/organization/OrganizationDeleteDialog.tsx

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { AdminService } from "@/api/services/AdminService";
import type { OrganizationResponse } from "@/api/models/OrganizationResponse";
import toast from "react-hot-toast";

interface DeleteOrgConfirmResponse {
  org_name_hash: string;
}

interface OrganizationDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organization: OrganizationResponse;
  onDeleteSuccess: () => void;
}

export default function OrganizationDeleteDialog({
  isOpen,
  onClose,
  organization,
  onDeleteSuccess,
}: OrganizationDeleteDialogProps) {
  const [orgNameHash, setOrgNameHash] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  // Get the org_name_hash when dialog opens
  useEffect(() => {
    if (isOpen && !orgNameHash) {
      const getOrgHash = async () => {
        try {
          const response = await AdminService.deleteOrganizationAdminOrganizationsOrganizationIdDelete(
            organization.id,
            "" // Empty hash to get the org_name_hash
          );
          
          // Extract org_name_hash from response
          if (typeof response === 'object' && 'org_name_hash' in response) {
            setOrgNameHash((response as DeleteOrgConfirmResponse).org_name_hash);
          }
        } catch (error) {
          console.error("Failed to get organization hash:", error);
          toast.error("Failed to initialize delete process");
        }
      };
      
      getOrgHash();
    }
  }, [isOpen, organization.id, orgNameHash]);

  const handleConfirmDelete = async () => {
    if (confirmText.trim() !== organization.name) {
      toast.error('Please enter the organization name to confirm');
      return;
    }

    if (!orgNameHash) {
      toast.error("Organization hash not available. Please close and try again.");
      return;
    }

    setLoading(true);
    try {
      await AdminService.deleteOrganizationAdminOrganizationsOrganizationIdDelete(
        organization.id,
        orgNameHash
      );
      toast.success("Organization deleted successfully");
      onDeleteSuccess();
      handleClose();
    } catch (error) {
      console.error("Failed to delete organization:", error);
      toast.error("Failed to delete organization");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOrgNameHash("");
    setConfirmText("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[500px] m-4">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Delete Organization
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          This action cannot be undone and will lead to permanent deletion of the organization{" "}
          <span className="font-semibold">"{organization.name}"</span> and all associated users and data.
        </p>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            To confirm deletion, please type the organization name in the field below:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`Type "${organization.name}" to confirm`}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     focus:ring-2 focus:ring-red-500 focus:border-red-500
                     dark:bg-gray-700 dark:text-white"
            disabled={loading}
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmDelete}
            disabled={loading || confirmText.trim() !== organization.name}
            className="bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400"
          >
            {loading ? "Deleting..." : "Delete Organization"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}