// components/entity/EntityCompactCard.tsx
"use client";
import React from "react";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

export interface CompactField<T> {
  label: string;
  field: keyof T;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
}

interface EntityCompactCardProps<T> {
  item: T;
  nameField: keyof T;
  fields: CompactField<T>[];
  onEdit?: () => void;
  onRemove?: () => void;
}

/**
 * Compact card view for displaying an entity in a list.
 * Shows name prominently with fields stacked below, and small action icons.
 */
export function EntityCompactCard<T extends Record<string, unknown>>({
  item,
  nameField,
  fields,
  onEdit,
  onRemove,
}: EntityCompactCardProps<T>) {
  const name = item[nameField];
  const displayName = name != null ? String(name) : "Untitled";

  return (
    <div className="group relative p-4 border border-gray-200 rounded-xl dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
      {/* Action buttons - top right */}
      {(onEdit || onRemove) && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              title="Edit"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              title="Remove"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Name */}
      <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90 pr-16">
        {displayName}
      </h5>

      {/* Fields */}
      <div className="mt-1.5 space-y-0.5">
        {fields.map(({ field, render }) => {
          const value = item[field];
          if (value == null || value === "") return null;
          const display = render ? render(value, item) : String(value);
          return (
            <p
              key={String(field)}
              className="text-xs text-gray-500 dark:text-gray-400 truncate"
            >
              {display}
            </p>
          );
        })}
      </div>
    </div>
  );
}
