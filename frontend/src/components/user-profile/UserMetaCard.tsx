"use client";
import React, { useState, useEffect } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { AdminService } from "@/api/services/AdminService";

export default function UserMetaCard() {
  const { currentUser, isLoading } = useCurrentUser();
  const [organizationName, setOrganizationName] = useState<string>("");

  // Function to generate a consistent color based on the user's name
  const generateAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500'
    ];
    
    // Generate a consistent index based on the name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  useEffect(() => {
    const fetchOrganizationInfo = async () => {
      if (currentUser?.organization_id) {
        try {
          const orgData = await AdminService.getOrganizationAdminOrganizationsOrganizationIdGet(currentUser.organization_id);
          setOrganizationName(orgData.name);
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
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-200 rounded-full animate-pulse dark:bg-gray-700"></div>
          <div className="space-y-2">
            <div className="w-32 h-6 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
            <div className="w-24 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-700"></div>
          </div>
        </div>
      </div>
    );
  }

  const nameParts = currentUser?.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Get initials for avatar
  const getInitials = (firstName: string, lastName: string) => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    return firstInitial + lastInitial;
  };
  
  const initials = getInitials(firstName, lastName);
  const avatarColor = generateAvatarColor(currentUser?.name || '');

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
        <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
          <div className={`w-20 h-20 rounded-full ${avatarColor} flex items-center justify-center border border-gray-200 dark:border-gray-800`}>
            <span className="text-xl font-bold text-white">
              {initials}
            </span>
          </div>
          <div>
            <h4 className="mb-2 text-xl font-bold text-center text-gray-800 dark:text-white/90 xl:text-left">
              {firstName} {lastName}
            </h4>
            {organizationName && (
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 xl:text-left">
                {organizationName}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}