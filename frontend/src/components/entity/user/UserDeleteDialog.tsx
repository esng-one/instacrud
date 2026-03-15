//components/entity/user/UserDeleteDialog.tsx

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { AdminService } from "@/api/services/AdminService";
import type { UserResponse } from "@/api/models/UserResponse";
import toast from "react-hot-toast";

interface UserDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserResponse;
  onDeleteSuccess: () => void;
}

export default function UserDeleteDialog({
  isOpen,
  onClose,
  user,
  onDeleteSuccess,
}: UserDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirmDelete = async () => {
    if (confirmText.trim() !== "DELETE") {
      toast.error('Please enter "DELETE" to confirm');
      return;
    }

    setLoading(true);
    try {
      await AdminService.deleteUserAdminUsersUserIdDelete(user.id);
      toast.success("User deleted successfully");
      onDeleteSuccess();
      handleClose();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast.error("Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  const isDeleteEnabled = confirmText === "DELETE" && !loading;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[500px] m-4">
      <div className="p-6">
        {/* Warning Icon */}
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-3">
            <svg 
              className="w-5 h-5 text-red-600 dark:text-red-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Delete User
          </h2>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          This action cannot be undone and will permanently delete the user{" "}
          <span className="font-semibold text-gray-900 dark:text-white">"{user.name}"</span>{" "}
          <span className="text-gray-500">({user.email})</span>.
        </p>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            To confirm deletion, please type <span className="font-bold text-red-600">DELETE</span> in the field below:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isDeleteEnabled) {
                handleConfirmDelete();
              }
            }}
            placeholder="Type DELETE to confirm"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:ring-2 focus:ring-red-500 focus:border-red-500 
                     dark:bg-gray-700 dark:text-white"
            disabled={loading}
            autoComplete="off"
            autoFocus
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
            disabled={!isDeleteEnabled}
            className="bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Deleting..." : "Delete User"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}