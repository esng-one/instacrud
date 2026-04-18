"use client";
import React, { useState } from "react";
import useMe from "@/hooks/useMe";
import { MeService } from "@/api/services/MeService";
import { SystemService } from "@/api/services/SystemService";
import { formatEnum, useTailwindMuiTheme } from "@/app/lib/util";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { EyeCloseIcon, EyeIcon } from "@/icons";
import toast from "react-hot-toast";
import { getApiErrorDetail } from "@/app/lib/api-error";
import { ThemeProvider } from "@mui/material";
import { useRouter } from "next/navigation";
import { logout } from "@/app/lib/util";

export default function UserInfoCard() {
  const { me, isLoading, updateMe } = useMe();
  const router = useRouter();
  const theme = useTailwindMuiTheme();
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [isEditProfileSubmitting, setIsEditProfileSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await SystemService.changePasswordChangePasswordPost({
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success("Password changed successfully!");
      setIsChangePasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(getApiErrorDetail(error) as string);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = () => {
    logout(router, undefined, "/forgot-password");
  };

  const openEditProfile = () => {
    setEditFirstName(firstName);
    setEditLastName(lastName);
    setIsEditProfileModalOpen(true);
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = [editFirstName.trim(), editLastName.trim()].filter(Boolean).join(" ");
    setIsEditProfileSubmitting(true);
    try {
      const saved = await MeService.patchMeMePatch({ name });
      updateMe(saved);
      toast.success("Profile updated successfully!");
      setIsEditProfileModalOpen(false);
    } catch (error) {
      toast.error(getApiErrorDetail(error) as string);
    } finally {
      setIsEditProfileSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="space-y-4">
          <div className="w-32 h-6 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="w-20 h-3 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
                <div className="w-24 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const nameParts = me?.user.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const hasPassword = me?.user.has_password ?? true;

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-6">
            Account Information
          </h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                First Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {firstName || 'N/A'}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Last Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {lastName || 'N/A'}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Email Address
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {me?.user.email || 'N/A'}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Role
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {formatEnum(me?.user.role ?? "")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
          {me?.user.role !== 'RO_USER' && (
            <Button
              onClick={openEditProfile}
              variant="outline"
            >
              Edit Profile
            </Button>
          )}
          {hasPassword ? (
            <Button
              onClick={() => setIsChangePasswordModalOpen(true)}
              variant="outline"
            >
              Change Password
            </Button>
          ) : (
            <Button
              onClick={handleResetPassword}
              variant="outline"
            >
              Reset Password
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={isChangePasswordModalOpen}
        onClose={() => {
          setIsChangePasswordModalOpen(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }}
        className="max-w-[700px] m-4"
      >
        <ThemeProvider theme={theme}>
          <div className="relative mx-auto max-w-[700px] m-4 overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Change Password
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Update your password to keep your account secure.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="flex flex-col">
            <div className="custom-scrollbar max-h-[450px] overflow-y-auto px-2 pb-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="[&_.MuiInputBase-input::placeholder]:text-gray-400 dark:[&_.MuiInputBase-input::placeholder]:text-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute transform -translate-y-1/2 right-4 top-1/2"
              >
                {showCurrentPassword ? (
                  <EyeIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <EyeCloseIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="[&_.MuiInputBase-input::placeholder]:text-gray-400 dark:[&_.MuiInputBase-input::placeholder]:text-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute transform -translate-y-1/2 right-4 top-1/2"
              >
                {showNewPassword ? (
                  <EyeIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <EyeCloseIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="[&_.MuiInputBase-input::placeholder]:text-gray-400 dark:[&_.MuiInputBase-input::placeholder]:text-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute transform -translate-y-1/2 right-4 top-1/2"
              >
                {showConfirmPassword ? (
                  <EyeIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <EyeCloseIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>

              </div>
            </div>

            {newPassword && newPassword.length < 8 && (
              <p className="text-xs text-red-500 px-2 mt-2">
                Password must be at least 8 characters long
              </p>
            )}
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 px-2 mt-2">
                Passwords do not match
              </p>
            )}

            <div className="mt-7 flex gap-3 px-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsChangePasswordModalOpen(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                className="flex-1"
              >
                {isSubmitting ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </form>
        </div>
        </ThemeProvider>
      </Modal>
      <Modal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        className="max-w-[500px] m-4"
      >
        <ThemeProvider theme={theme}>
          <div className="relative mx-auto max-w-[500px] m-4 overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
            <div className="px-2 pr-14">
              <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                Edit Profile
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                Update your display name.
              </p>
            </div>

            <form onSubmit={handleEditProfile} className="flex flex-col">
              <div className="custom-scrollbar overflow-y-auto px-2 pb-3">
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="editFirstName">First Name</Label>
                    <Input
                      id="editFirstName"
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editLastName">Last Name</Label>
                    <Input
                      id="editLastName"
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-7 flex gap-3 px-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isEditProfileSubmitting || !editFirstName.trim()}
                  className="flex-1"
                >
                  {isEditProfileSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </ThemeProvider>
      </Modal>
    </div>
  );
}