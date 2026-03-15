// app/lib/util.ts
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { OpenAPI } from "@/api";
import { useEffect, useState } from "react";
import { createTheme } from "@mui/material/styles";
import { DetailField } from "@/components/entity/EntityDetailView";

export function logout(router: ReturnType<typeof useRouter>, reason?: { message: string, action: string }, redirectPath: string = "/signin") {
  if (reason) {
    sessionStorage.setItem("logoutReason", JSON.stringify(reason));
  }
  localStorage.removeItem("token");
  localStorage.removeItem("user.info");
  sessionStorage.setItem("originalUrl", window.location.pathname);
  OpenAPI.TOKEN = undefined;
  router.push(redirectPath);
}

export function navigateWithStatus(router: ReturnType<typeof useRouter>, path: string, status: string, message: string, {replace = false} = {}) {
  const query = new URLSearchParams({status, message}).toString();
  const url = `${path}?${query}`;
  if (replace) {
    router.replace(url, {scroll: false});
  } else {
    router.push(url);
  }
}

export function formatEnum(value: string): string {
  if (!value) return value;
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { timeZone: 'UTC' });
};

export function formatDateTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? "" : date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

export function formatNumber(value: unknown, fallback = "–"): string {
  return typeof value === "number" ? value.toFixed(2) : fallback;
}

export function formatValue(value: unknown): string {
  if (value === null) return "";
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return "[object]";
  return String(value);
}

export function formatByteSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || typeof bytes !== "number" || isNaN(bytes) || !isFinite(bytes)) {
    return "";
  }
  try {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1000));
    const formattedSize = (bytes / Math.pow(1000, i)).toFixed(1);
    return `${formattedSize} ${sizes[i]}`;
  } catch {
    return "";
  }
}

export function toLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

/**
 * Injects common fields like Created At / Updated At for any entity
 */

export function injectCommonFields<
  T extends {
    created_at?: string | Date | null;
    updated_at?: string | Date | null;
    created_by?: string | null;
    updated_by?: string | null;
  }
>(): DetailField<T>[] {
  return [
    {
      label: "Created At",
      field: "created_at",
      render: (value: T[keyof T], item: T) => {
        if (!value)
          return React.createElement("span", { className: "text-gray-400" }, "N/A");
        return React.createElement(
          "span",
          null,
          formatDate(value),
          " (",
          React.createElement(
            "span",
            { className: "text-gray-500" },
            `by ${item.created_by ?? "Unknown"}`
          ),
          ")"
        );
      },
    },
    {
      label: "Updated At",
      field: "updated_at" as keyof T,
      render: (value: T[keyof T], item: T) => {
        if (!value)
          return React.createElement("span", { className: "text-gray-400" }, "N/A");
        return React.createElement(
          "span",
          null,
          formatDate(value),
          " (",
          React.createElement(
            "span",
            { className: "text-gray-500" },
            `by ${item.updated_by ?? "Unknown"}`
          ),
          ")"
        );
      },
    },
  ];
}


export function useTailwindMuiTheme() {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";
  const getVar = (name: string) =>
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      : "";

  return createTheme({
    palette: {
      mode,
      background: {
        default: getVar(isDark ? "--color-gray-dark" : "--color-gray-50"),
        paper: getVar(isDark ? "--color-gray-dark" : "--color-white"),
      },
      text: {
        primary: getVar(isDark ? "--color-gray-50" : "--color-gray-900"),
        secondary: getVar(isDark ? "--color-gray-400" : "--color-gray-500"),
      },
    },
    components: {
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            height: "44px",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            backgroundColor: "transparent",
            transition: "border-color .15s ease, box-shadow .15s ease",
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: getVar(isDark ? "--color-gray-600" : "--color-gray-400"),
            },
            "&.Mui-focused": {
              boxShadow: `0 0 0 3px ${getVar("--color-brand-500")}33`,
              outline: "none",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: getVar(isDark ? "--color-brand-800" : "--color-brand-300"),
              borderWidth: "1px",
            },
            "&.Mui-error .MuiOutlinedInput-notchedOutline": {
              borderColor: getVar("--color-error-500"),
              borderWidth: "1px",
            },
            "&.Mui-error": {
              boxShadow: `0 0 0 4px ${getVar("--color-error-500")}33`,
            },
            "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
              borderColor: getVar(isDark ? "--color-gray-700" : "--color-gray-200"),
            },
          },
          notchedOutline: {
            borderColor: getVar(isDark ? "--color-gray-700" : "--color-gray-300"),
            borderWidth: "1px !important",
            borderRadius: "0.5rem",
            transition: "border-color .15s ease",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiFormHelperText-root": {
              fontSize: "0.75rem", // text-xs
              marginTop: "0.25rem",
              color: getVar("--color-gray-500"),
            },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: "0.875rem",
            color: getVar(isDark ? "--color-gray-50" : "--color-gray-900"),
            "&.Mui-selected": {
              backgroundColor: "var(--color-brand-100)",
              color: "var(--color-gray-900)",
            },
            "&.Mui-selected:hover": {
              backgroundColor: "var(--color-brand-200)",
            },
            "&:hover": {
              backgroundColor: getVar("--color-gray-100"),
              color: getVar("--color-gray-900"),
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: getVar(isDark ? "--color-gray-800" : "--color-white"),
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: { color: "var(--color-gray-500)" },
          select: { paddingTop: 10, paddingBottom: 10 },
        },
      },
      // @ts-expect-error: Suppress type error for DataGrid theme override
      MuiDataGrid: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: "1px solid",
            borderColor: getVar(isDark ? "--color-gray-800" : "--color-gray-200"),
            overflow: "hidden",
            backgroundColor: getVar(isDark ? "--color-gray-dark" : "--color-white"),
            "& .MuiDataGrid-columnHeader, & .MuiDataGrid-columnHeaderTitle": {
              color: getVar(isDark ? "--color-gray-50" : "--color-gray-900"),
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              backgroundColor: getVar(isDark ? "--color-gray-800" : "--color-gray-200"),
            },
            "& .MuiDataGrid-cell": {
              color: getVar(isDark ? "--color-gray-50" : "--color-gray-900"),
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
            "& .MuiDataGrid-footerContainer": {
              backgroundColor: getVar(isDark ? "--color-gray-800" : "--color-gray-200"),
              color: getVar(isDark ? "--color-gray-50" : "--color-gray-900"),
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: getVar(isDark ? "--color-gray-700" : "--color-gray-100"),
            },
          },
        },
      },
    },
  });
}
