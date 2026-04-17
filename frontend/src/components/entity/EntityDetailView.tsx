// components/entity/EntityDetailView.tsx
"use client";
import React, { useMemo } from "react";
import { useAiPageContext } from "@/hooks/useAiPageContext";

export interface DetailField<T> {
  label: string;
  field: keyof T;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
}

interface EntityDetailViewProps<T> {
  item: T;
  fields: DetailField<T>[];
  onEdit?: () => void;
  onRemove?: () => void;
  detailExtras?: (item: T) => React.ReactNode;
  modelName: string;
  /** Set to false to prevent this instance from publishing its data as the AI panel context (e.g. for sub-entity sections). Defaults to true. */
  publishAiContext?: boolean;
}

/**
 * Generic detail view to display fields of a single item.
 * Preserves styling & dark mode from original detail views.
 */
export function EntityDetailView<T extends Record<string, unknown>>({
  item,
  fields,
  onEdit,
  onRemove,
  detailExtras,
  modelName,
  publishAiContext = true,
}: EntityDetailViewProps<T>) {
  // Publish current item to the in-page AI assistant
  const contextJson = useMemo(() => {
    try {
      return JSON.stringify(item, null, 2);
    } catch {
      return "";
    }
  }, [item]);
  useAiPageContext({ context: contextJson, systemPrompt: "", enabled: publishAiContext });

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 space-y-6 bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left side: Title + fields */}
        <div className="flex-1 space-y-4 lg:space-y-6">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {modelName} Information
          </h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7">
            {fields.map(({label, field, render}) => {
              const value = item[field];
              const display =
                  render ? render(value, item) : value != null ? String(value) : "No data";
              return (
                  <div key={String(field)} className="col-span-1 lg:col-span-1 min-w-0">
                    <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                      {label}
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90 break-words">
                      {display}
                    </p>
                  </div>
              );
            })}
          </div>
        </div>

        {/* Right side: Optional Actions (Edit + Remove) */}
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3
                       text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800
                       dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]
                       dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            Edit
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="flex items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-4 py-3
                        text-sm font-medium text-red-600 shadow-theme-xs hover:bg-red-50 hover:text-red-700
                        dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-white/[0.03]
                        dark:hover:text-red-300 lg:w-auto"
          >
            Remove
          </button>
        )}
      </div>

      {/* Extra custom detail blocks */}
      {detailExtras && detailExtras(item)}
    </div>
  );
}
