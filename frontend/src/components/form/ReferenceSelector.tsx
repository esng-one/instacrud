// components/form/ReferenceSelector.tsx

"use client";
import React from "react";
import {
  Autocomplete,
  CircularProgress,
  Divider,
  TextField,
  createFilterOptions,
} from "@mui/material";
import type { ReferenceOption } from "@/hooks/useReferenceField";
import type { State } from "@popperjs/core";

interface ReferenceSelectorProps<T, R = T> {
  field: keyof T | "ref";
  value: string | number | null;
  onChange: (field: keyof T | "ref", value: string | number | null) => void;
  options: ReferenceOption<R>[];
  loading?: boolean;
  disabled?: boolean;
  onCreateNew?: (prefill?: string) => void;
  createLabel?: string;
  error?: boolean;
  hint?: string;
  required?: boolean;
}

type OptionType<R> =
  | ReferenceOption<R>
  | { inputValue: string; label: string; isNew?: boolean }
  | string;

export default function ReferenceSelector<T, R = T>({
  field,
  value,
  onChange,
  options,
  loading = false,
  disabled = false,
  onCreateNew,
  createLabel,
  error,
  hint,
  required,
}: ReferenceSelectorProps<T, R>) {
  const selectedOption = options.find((opt) => opt.value === value) ?? null;
  const filter = createFilterOptions<OptionType<R>>();

  return (
    <Autocomplete
      freeSolo={!!onCreateNew}
      clearOnBlur
      selectOnFocus
      handleHomeEndKeys
      disabled={disabled}
      value={selectedOption}
      options={options as OptionType<R>[]}
      loading={loading}
      filterOptions={(opts, params) => {
        const filtered = filter(opts, params);
        const { inputValue } = params;

        // Only append "Add ..." when creation is allowed and no existing match
        const isExisting = opts.some(
          (opt) =>
            typeof opt === "object" &&
            "label" in opt &&
            opt.label.toLowerCase() === inputValue.toLowerCase()
        );

        if (onCreateNew && inputValue !== "" && !isExisting) {
          filtered.push({
            inputValue,
            label: `${createLabel ?? "Add"} "${inputValue}"`,
            isNew: true,
          });
        }

        return filtered;
      }}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        if ("inputValue" in option && option.isNew) return option.label; // Show Add "xxx"
        if ("label" in option) return option.label;
        return "";
      }}
      onChange={(_, newValue) => {
        if (!newValue) {
          onChange(field, null);
          return;
        }

        if (typeof newValue === "string") {
          onCreateNew?.(newValue);
          return;
        }

        if ("inputValue" in newValue && newValue.isNew) {
          onCreateNew?.(newValue.inputValue);
          return;
        }

        if ("value" in newValue) {
          onChange(field, newValue.value);
        }
      }}
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        const label = typeof option === "string"
          ? option
          : "label" in option
            ? option.label
            : "";
        const hasDivider = typeof option === "object" && "hasDivider" in option && !!option.hasDivider;

        return (
          <li key={key} {...otherProps}>
            <div style={{ width: '100%' }}>
              {label}
              {hasDivider && <Divider sx={{ mt: 1 }} />}
            </div>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          size="small"
          disabled={disabled}
          error={error}
          helperText={hint || ""}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                  <>
                    {loading && <CircularProgress color="inherit" size={18}/>}
                    {params.InputProps.endAdornment}
                  </>
              ),
            }
          }}
        />
      )}
      disableClearable={required}
      slotProps={{
        popper: {
          modifiers: [
            {
              name: "zIndex",
              enabled: true,
              phase: "write",
              fn({ state }: { state: State }) {
                state.styles.popper.zIndex = "100000";
              },
            },
          ],
        },
      }}
    />
  );
}
