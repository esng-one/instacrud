// components/entity/EntityDetailExtras.tsx
"use client";
import React, {useEffect, useState} from "react";
import { toast } from "react-hot-toast";
import { EntityDetailView, DetailField } from "@/components/entity/EntityDetailView";
import { EntityCompactCard, CompactField } from "@/components/entity/EntityCompactCard";
import { CircularProgress } from "@mui/material";
import Button from "@/components/ui/button/Button";
import ReferenceSelector from "@/components/form/ReferenceSelector";
import type { ReferenceOption } from "@/hooks/useReferenceField";
import type {PydanticObjectId} from "@/api";

interface EntityDetailExtrasProps<T> {
  ids?: string[] | null;
  fetchFn?: (id: string) => Promise<T>;    // per-item fetch
  fetchAllFn?: () => Promise<T[]>;         // bulk fetch
  title: string;
  nameField: keyof T;
  fields: (DetailField<T> | CompactField<T>)[];
  modelName: string;
  onEditItem?: (item: T, modelName: string) => void;
  onRemoveItem?: (item: T, modelName: string) => void;
  onNewItem?: (prefill?: string) => void;
  canCreate?: boolean;
  newItemLabel?: string;
  canAddExisting?: boolean;
  addOptions?: ReferenceOption<T>[];
  addOptionsLoading?: boolean;
  onAddItem?: (id: string, modelName: string) => void;
  forceLoading?: boolean;
  refreshKey?: number;
  /** Display variant: "full" uses EntityDetailView, "compact" uses EntityCompactCard */
  variant?: "full" | "compact";
}

export function EntityDetailExtras<T extends { _id?: (PydanticObjectId | null) }>({
  ids,
  fetchFn,
  fetchAllFn,
  title,
  nameField,
  fields,
  modelName,
  onEditItem,
  onRemoveItem,
  onNewItem,
  canCreate = false,
  newItemLabel,
  canAddExisting = false,
  addOptions = [],
  addOptionsLoading = false,
  onAddItem,
  forceLoading,
  refreshKey,
  variant = "full",
}: EntityDetailExtrasProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const idsKey = JSON.stringify(ids ?? []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        if (fetchAllFn) {
          const data = await fetchAllFn();
          if (!cancelled) setItems(data);
          return;
        }

        if (!idsKey || idsKey === "[]" || !fetchFn) {
          setItems([]);
          return;
        }

        // legacy per-id fallback
        const results = await Promise.allSettled(JSON.parse(idsKey).map((id: string) => fetchFn(String(id))));
        if (!cancelled) {
          const successful = results
            .map((res) => (res.status === "fulfilled" ? res.value : null))
            .filter((val): val is NonNullable<typeof val> => val !== null);
          setItems(successful);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`Failed to fetch ${title}`, err);
          toast.error(`Error fetching ${title} data`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [idsKey, fetchAllFn, fetchFn, title, refreshKey]);

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 bg-white dark:bg-gray-900 space-y-4">
      <div className="flex gap-2 items-center">
        <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {title}
        </h4>
        <div className="flex-1" />
        {canAddExisting && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
                Add {modelName}
            </Button>
        )}
        {canCreate && onNewItem && (
            <Button size="sm" variant="outline" onClick={() => onNewItem?.()}>
                {newItemLabel ?? `New ${modelName}`}
            </Button>
        )}
      </div>
      {canAddExisting && adding && (
        <div className="flex gap-2 items-center">
            <div className="flex-1">
                <ReferenceSelector
                    field="ref"
                    value={selectedId}
                    onChange={(_, value) => setSelectedId(value as string)}
                    options={addOptions}
                    loading={addOptionsLoading}
                    // Enable inline creation automatically if onNewItem exists
                    onCreateNew={onNewItem}
                    createLabel={newItemLabel}
                />
            </div>
            <Button
                size="sm"
                onClick={() => {
                    if (selectedId && onAddItem) {
                        onAddItem(selectedId, modelName);
                        setAdding(false);
                        setSelectedId(null);
                    }
                }}
            >
                Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
                Cancel
            </Button>
        </div>
      )}

      {!ids || ids.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No {title}</p>
      ) : loading || forceLoading ? (
        <div className="flex justify-center py-6">
          <CircularProgress size={24} />
        </div>
      ) : items.length > 0 ? (
        variant === "compact" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((item, i) => (
              <EntityCompactCard<T>
                key={item._id ?? i}
                item={item}
                nameField={nameField}
                fields={fields}
                onEdit={onEditItem ? () => onEditItem(item, modelName) : undefined}
                onRemove={onRemoveItem ? () => onRemoveItem(item, modelName) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, i) => (
              <div
                key={item._id ?? i}
                className="p-4 border border-gray-200 rounded-2xl dark:border-gray-800 space-y-2"
              >
                <h5 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {String(item[nameField]) || `${modelName} ${i + 1}`}
                </h5>
                <EntityDetailView<T>
                  item={item}
                  fields={fields as DetailField<T>[]}
                  onEdit={() => onEditItem?.(item, modelName)}
                  onRemove={() => onRemoveItem?.(item, modelName)}
                  modelName={modelName}
                />
              </div>
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">No {title}</p>
      )}
    </div>
  );
}
