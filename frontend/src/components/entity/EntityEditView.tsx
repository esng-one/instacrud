// components/entity/EntityEditView.tsx
"use client";
import React, { useEffect, useState } from "react";
import DatePicker from "@/components/form/DatePicker";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import ReferenceSelector from "@/components/form/ReferenceSelector";
import Button from "@/components/ui/button/Button";
import type { ReferenceOption } from "@/hooks/useReferenceField";
import {useApiFormErrors} from "@/hooks/useApiFormErrors";
import Select from "@/components/form/Select";
import {toLocalIsoDate} from "@/app/lib/util";
import TextArea from "@/components/form/input/TextArea";

export type EditField<T, R = T> = {
  label: string;
  field: keyof T;
  type: "text" | "textarea" | "select" | "reference" | "date" | "number" | "checkbox";
  options?: (string | number)[] | ReferenceOption<R>[];
  render?: (value: string | number | boolean, item: T) => React.ReactNode;
  loading?: boolean;
  required?: boolean;
  disabled?: boolean;
};

interface EntityEditViewProps<T, R = T> {
  item: T;
  fields: readonly EditField<T, R>[];
  onSubmit: (updatedItem: T) => void;
  onCancel: () => void;
  mode: "create" | "edit";
  modelName: string;
  canSubmit?: boolean;
  extraContent?: React.ReactNode;
}

export function EntityEditView<T extends Record<string, unknown>, R = T>({
  item: originalItem,
  fields,
  onSubmit,
  onCancel,
  mode,
  modelName,
  canSubmit = true,
  extraContent,
}: EntityEditViewProps<T, R>) {
  const [item, setItem] = useState<T>(originalItem);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fieldErrors, handleApiError, clearFieldErrors } = useApiFormErrors();

  useEffect(() => {
    setItem(originalItem);
  }, [originalItem]);

  return (
    <div className="relative mx-auto max-w-[700px] m-4 overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
      <div className="px-2 pr-14">
        <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
          {mode === "edit" ? `Edit ${modelName} Information` : `New ${modelName}`}
        </h4>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
          {mode === "edit"
            ? `Update ${modelName.toLowerCase()} details to keep your records up-to-date.`
            : `Enter new ${modelName.toLowerCase()} details below.`}
        </p>
      </div>

      <form
        className="flex flex-col"
        onSubmit={async (e) => {
          e.preventDefault();
          if (isSubmitting) return;
          setIsSubmitting(true);
          clearFieldErrors();
          try {
            await onSubmit(item);
          } catch (err) {
            handleApiError(err);
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        <div className="custom-scrollbar max-h-[450px] overflow-y-auto px-2 pb-3">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
            {fields.map(({ label, field, type, options, render, loading, required, disabled }) => {
              const value = item[field];
              const labelText = (
                <>
                  {label}
                  {required && <span className="text-error-500 ml-1">*</span>}
                </>
              );
              return (
                <div
                  key={String(field)}
                  className={type === "textarea" ? "col-span-1 lg:col-span-2" : type === "checkbox" ? "col-span-1 lg:col-span-2" : ""}
                >
                  {type !== "checkbox" && <Label>{labelText}</Label>}
                  {type === "checkbox" ? (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={String(field)}
                        checked={Boolean(value)}
                        onChange={(e) =>
                          setItem({ ...item, [field]: e.target.checked } as T)
                        }
                        disabled={disabled}
                        className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <label
                        htmlFor={String(field)}
                        className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {labelText}
                      </label>
                    </div>
                  ) : type === "reference" && options ? (
                    <ReferenceSelector<T, R>
                      field={field}
                      value={value as string | number | null}
                      onChange={(field, newValue) =>
                        setItem({ ...item, [field]: newValue } as T)
                      }
                      options={options as ReferenceOption<R>[]}
                      loading={loading}
                      disabled={disabled}
                      required={required}
                      error={!!fieldErrors[String(field)]}
                      hint={fieldErrors[String(field)]}
                    />
                  ) : type === "date" ? (
                    <DatePicker
                      id={String(field)}
                      // defaultDate={value ? new Date(String(value).split("T")[0] + "T12:00:00") : undefined}
                      value={value ? String(value) : null}
                      onChange={(selectedDates) => {
                        const selected = Array.isArray(selectedDates) ? selectedDates[0] : null;

                        if (selected && !isNaN(selected.getTime())) {
                          const iso = toLocalIsoDate(selected);
                          setItem((prev) => ({ ...prev, [field]: iso } as T));
                        } else {
                          setItem((prev) => ({ ...prev, [field]: null } as T));
                        }
                      }}
                      disabled={disabled}
                      required={required}
                      error={!!fieldErrors[String(field)]}
                      hint={fieldErrors[String(field)]}
                    />

                  ) : type === "select" && options ? (
                    <Select
                      options={(options as (string | number)[]).map((opt) => ({
                        value: String(opt),
                        label: render ? String(render(opt, item)) : String(opt),
                      }))}
                      defaultValue={String(value ?? "")}
                      onChange={(val) => {
                        const parsed = val === "true" ? true : val === "false" ? false : val;
                        setItem({ ...item, [field]: parsed } as T);
                      }}
                      disabled={loading || disabled}
                      required={required}
                      error={!!fieldErrors[String(field)]}
                      hint={fieldErrors[String(field)]}
                      className="bg-white dark:bg-gray-900"
                      placeholder={`Select ${label.toLowerCase()}`}
                    />
                  ) : type === "number" ? (
                    <Input
                      type="number"
                      value={String(value ?? "")}
                      onChange={(e) =>
                        setItem({ ...item, [field]: e.target.value ? parseFloat(e.target.value) : null } as T)
                      }
                      disabled={disabled}
                      required={required}
                      error={!!fieldErrors[String(field)]}
                      hint={fieldErrors[String(field)]}
                    />
                  ) : type === "textarea" ? (
                    <TextArea
                      placeholder={label}
                      value={String(value ?? "")}
                      onChange={(val) =>
                        setItem({ ...item, [field]: val } as T)
                      }
                      disabled={disabled}
                      required={required}
                      error={!!fieldErrors[String(field)]}
                      hint={fieldErrors[String(field)]}
                      className="bg-white dark:bg-gray-900"
                    />
                  ) : (
                    <Input
                      type="text"
                      value={String(value ?? "")}
                      onChange={(e) =>
                        setItem({ ...item, [field]: e.target.value } as T)
                      }
                      disabled={disabled}
                      required={required}
                      error={!!fieldErrors[String(field)]}
                      hint={fieldErrors[String(field)]}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {extraContent && <div className="mt-4 px-2">{extraContent}</div>}

        <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setItem(originalItem);
              onCancel();
            }}
          >
            {mode === "edit" ? "Close" : "Cancel"}
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? (mode === "edit" ? "Saving..." : "Creating...") : (mode === "edit" ? "Save Changes" : "Create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
