// components/form/input/InputField.tsx
"use client";
import React from "react";
import { TextField } from "@mui/material";
import { twMerge } from "tailwind-merge";

interface InputProps {
  type?: "text" | "number" | "email" | "password" | "date" | string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string | number;
  defaultValue?: string | number;
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  success?: boolean;
  error?: boolean;
  hint?: string;
  className?: string;
}

const Input: React.FC<InputProps> = ({
  type = "text",
  id,
  name,
  placeholder,
  value,
  defaultValue,
  required,
  onChange,
  disabled = false,
  // success = false,
  error = false,
  hint,
  className = "",
}) => {
  return (
    <TextField
      id={id}
      name={name}
      type={type}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      fullWidth
      size="small"
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      error={error}
      helperText={hint || ""}
      variant="outlined"
      className={twMerge(className)}
      sx={{
        "& .MuiOutlinedInput-root": {
          ".dark &": {
            color: "rgba(255, 255, 255, 0.9)",
            backgroundColor: "transparent",
            "& fieldset": {
              borderColor: "rgba(255, 255, 255, 0.2)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(255, 255, 255, 0.3)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#3b82f6",
            },
          },
        },
        "& .MuiOutlinedInput-input": {
          ".dark &": {
            color: "rgba(255, 255, 255, 0.9)",
            "&::placeholder": {
              color: "rgba(255, 255, 255, 0.5)",
              opacity: 1,
            },
            "&.Mui-disabled": {
              WebkitTextFillColor: "rgba(255,255,255,0.2)",
            },
          },
        },
        "& .MuiInputLabel-root": {
          ".dark &": {
            color: "rgba(255, 255, 255, 0.7)",
          },
        },
        "& .MuiFormHelperText-root": {
          ".dark &": {
            color: "rgba(255, 255, 255, 0.6)",
          },
        },
      }}
    />
  );
};

export default Input;
