// components/form/Select.tsx
"use client";
import * as React from "react";
import { TextField, MenuItem } from "@mui/material";

interface Option { value: string; label: string; }

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  error?: boolean;
  hint?: string;
  required?: boolean;
  className?: string;
}

export default function Select({
  options,
  placeholder = "Select...",
  onChange,
  value,
  defaultValue = "",
  disabled = false,
  error = false,
  hint,
  required = false,
  className,
}: SelectProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const v = value ?? internal;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value as string;
    if (value === undefined) setInternal(val);
    onChange(val);
  };

  const renderValue = (selected: unknown): React.ReactNode => {
    const val =
      typeof selected === "string"
        ? selected
        : Array.isArray(selected)
        ? String(selected[0] ?? "")
        : String(selected ?? "");

    if (!val) {
      return <span style={{ color: "var(--color-gray-400)" }}>{placeholder}</span>;
    }
    const found = options.find(o => o.value === val);
    return found?.label ?? val;
  };

  return (
    <TextField
      className={className}
      select
      fullWidth
      size="small"
      variant="outlined"
      value={v}
      onChange={handleChange}
      disabled={disabled}
      error={error}
      helperText={hint || ""}
      slotProps={{
        select: {
          displayEmpty: !required,
          renderValue,
          MenuProps: {
            disablePortal: false,
            container: typeof window !== "undefined" ? document.body : undefined,
            slotProps: { root: { style: { zIndex: 100000 } } },
          },
        },
      }}
    >
      {!required && (
        <MenuItem value="">
          <span style={{ color: "var(--color-gray-400)" }}>{placeholder}</span>
        </MenuItem>
      )}
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
