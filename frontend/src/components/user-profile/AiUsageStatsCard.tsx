"use client";

import React, { useEffect, useState } from "react";
import { UsageService } from "@/api/services/UsageService";

interface UsageStats {
  user_id: string;
  organization_id: string | null;
  organization_name: string | null;
  tier_name: string;
  reset_at: string;
  usage: {
    used: number;
    limit: number | null;
    percentage: number;
    remaining: number | null;
  };
}

// Default empty stats
const createDefaultStats = (): UsageStats => ({
  user_id: "",
  organization_id: null,
  organization_name: null,
  tier_name: "No Tier",
  reset_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
  usage: {
    used: 0,
    limit: null,
    percentage: 0,
    remaining: null,
  },
});

export default function AiUsageStatsCard() {
  const [stats, setStats] = useState<UsageStats>(createDefaultStats());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsageStats = async () => {
    try {
      setRefreshing(true);
      const response = await UsageService.getUsageStatsUsageStatsGet();
      setStats(response as UsageStats);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch usage stats:", err);
      // Keep default stats on error, just show we couldn't refresh
      setError(null); // Don't show error, show default empty stats instead
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchUsageStats();
  }, []);

  const formatResetDate = (resetAt: string) => {
    const date = new Date(resetAt);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short'
    });
  };

  const formatUpdatedTime = (date: Date) => {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZoneName: 'short'
    });
  };

  const getProgressBarColor = (percentage: number): string => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-brand-500";
  };

  const formatCurrency = (value: number): string => {
    return `${Math.ceil(value)}`;
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h4 className="mb-4 text-base font-semibold text-gray-800 dark:text-white">
          Organization AI Usage
        </h4>
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-gray-800 dark:text-white">
            Organization AI Usage
          </h4>
          {stats.organization_name && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {stats.organization_name}
            </p>
          )}
        </div>
        {stats.tier_name !== "No Tier" && (
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            {stats.tier_name}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Usage
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {stats.usage.limit !== null ? (
                <>
                  {formatCurrency(stats.usage.used * 10000)} / {formatCurrency(stats.usage.limit * 10000)}
                </>
              ) : (
                <>{formatCurrency(stats.usage.used * 10000)} / {formatCurrency(0.4 * 10000)} (Unlimited)</>
              )}
            </span>
          </div>

          <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBarColor(stats.usage.percentage)} transition-all duration-300`}
              style={{ width: `${Math.max(Math.min(stats.usage.percentage, 100), 0)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 dark:text-gray-400">
              {stats.usage.percentage.toFixed(1)}% used
            </span>
            {stats.usage.remaining !== null && stats.usage.remaining > 0 && (
              <span className="text-gray-500 dark:text-gray-500">
                {formatCurrency(stats.usage.remaining * 10000)} remaining
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>Usage resets at:</span>
            <span className="font-medium text-gray-700 dark:text-gray-300 ml-2">
              {formatResetDate(stats.reset_at)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-between flex-1 sm:flex-initial sm:justify-end">
              <span className="text-gray-400 dark:text-gray-500">Updated at:</span>
              <span className="text-gray-400 dark:text-gray-500 ml-2">
                {formatUpdatedTime(lastUpdated)}
              </span>
            </div>
            <button
              onClick={fetchUsageStats}
              disabled={refreshing}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Refresh usage stats"
            >
              <svg
                className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
