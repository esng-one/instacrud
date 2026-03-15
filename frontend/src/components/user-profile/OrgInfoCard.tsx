"use client";
import React, { useState, useEffect } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { AdminService } from "@/api/services/AdminService";

interface OrganizationInfo {
  id: string;
  name: string;
  description?: string | null;
}

export default function OrgInfoCard() {
  const { currentUser, isLoading } = useCurrentUser();
  const [organizationInfo, setOrganizationInfo] = useState<OrganizationInfo | null>(null);

  useEffect(() => {
    const fetchOrganizationInfo = async () => {
      if (currentUser?.organization_id) {
        try {
          const orgData = await AdminService.getOrganizationAdminOrganizationsOrganizationIdGet(currentUser.organization_id);
          setOrganizationInfo(orgData);
        } catch (error) {
          console.error("Failed to fetch organization info:", error);
        }
      }
    };

    fetchOrganizationInfo();
  }, [currentUser?.organization_id]);

  if (isLoading) {
    return (
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="space-y-4">
          <div className="w-32 h-6 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="w-20 h-3 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
              <div className="w-24 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
            </div>
            <div className="space-y-2">
              <div className="w-20 h-3 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
              <div className="w-48 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!organizationInfo) {
    return (
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-6">
              Organization
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No organization information available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-6">
            Organization
          </h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Organization Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {organizationInfo.name}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Description
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {organizationInfo.description || 'No description available'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}