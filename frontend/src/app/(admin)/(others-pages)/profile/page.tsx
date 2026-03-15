import UserInfoCard from "@/components/user-profile/UserInfoCard";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import OrgInfoCard from "@/components/user-profile/OrgInfoCard";
import AiUsageStatsCard from "@/components/user-profile/AiUsageStatsCard";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Profile | InstaCRUD - Multi-Tenant CRUD Foundation",
  description: "A production-ready, extendable Python CRUD platform for multi-tenant SaaS.",
};

export default function Profile() {
  return (
    <div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">
          Profile
        </h3>
        <div className="space-y-6">
          <UserMetaCard />
          <UserInfoCard />
          <OrgInfoCard />
          <AiUsageStatsCard />
        </div>
      </div>
    </div>
  );
}