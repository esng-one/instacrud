// app/(admin)/organization/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { CircularProgress } from "@mui/material";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import useUserRole from "@/hooks/useUserRole";
import { MeService } from "@/api/services/MeService";
import type { MeOrganizationResponse } from "@/api/models/MeOrganizationResponse";
import MeOrganizationDetailView from "@/components/entity/organization/MeOrganizationDetailView";
import MeOrganizationEditView from "@/components/entity/organization/MeOrganizationEditView";

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { isOrgAdmin, isLoading: roleLoading } = useUserRole();
  const { isOpen, openModal, closeModal } = useModal();

  const [org, setOrg] = useState<MeOrganizationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isOrgAdmin) {
      router.replace("/");
    }
  }, [isOrgAdmin, roleLoading, router]);

  useEffect(() => {
    if (roleLoading || !isOrgAdmin) return;
    MeService.getMeOrganizationMeOrganizationGet()
      .then(setOrg)
      .catch(() => toast.error("Failed to load organization settings"))
      .finally(() => setLoading(false));
  }, [roleLoading, isOrgAdmin]);

  const handleSave = async (updated: MeOrganizationResponse) => {
    const saved = await MeService.patchMeOrganizationMeOrganizationPatch({
      name: updated.name,
      description: updated.description,
      local_only_conversations: updated.local_only_conversations,
    });
    setOrg(saved);
    toast.success("Organization settings saved");
    closeModal();
  };

  if (roleLoading || loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <CircularProgress />
      </div>
    );
  }

  if (!org) return null;

  return (
    <>
      <Toaster position="top-right" />
      <PageBreadcrumb items={[{ title: org.name }]} />

      <div className="mt-6">
        <MeOrganizationDetailView item={org} onEdit={openModal} />
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <MeOrganizationEditView
          item={org}
          onSubmit={handleSave}
          onCancel={closeModal}
        />
      </Modal>
    </>
  );
}
