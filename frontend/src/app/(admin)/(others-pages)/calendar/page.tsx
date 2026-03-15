import Calendar from "@/components/calendar/Calendar";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Calendar | InstaCRUD - Multi-Tenant CRUD Foundation",
  description: "A production-ready, extendable Python CRUD platform for multi-tenant SaaS.",
};
export default function page() {
  return (
    <div>
      <PageBreadcrumb items={[{ title: "Calendar"}]}/>
      <Calendar />
    </div>
  );
}
