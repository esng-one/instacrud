import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalendarIcon, CloseLineIcon } from "../../icons";
import { InputAdornment, TextField, IconButton } from "@mui/material";
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  value?: string | null;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  label?: string;
  placeholder?: string;
  error?: boolean;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
};

export default function DatePicker({
  id,
  value,
  mode,
  onChange,
  label,
  placeholder,
  error = false,
  hint,
  disabled = false,
  required = false,
}: PropsType) {
  const fpRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    const inputEl = document.getElementById(id) as HTMLInputElement | null;
    if (!inputEl) return;

    const fp = flatpickr(inputEl, {
      mode: mode || "single",
      disableMobile: true,
      static: false,
      monthSelectorType: "static",
      dateFormat: "n/j/Y",
      enableTime: false,
      time_24hr: true,
      defaultHour: 0,
      defaultMinute: 0,
      allowInput: false,
      appendTo: document.body,
      positionElement: inputEl,
      onChange: (selectedDates, dateStr, instance) => {
        if (typeof onChange === "function") {
          onChange(selectedDates, dateStr, instance);
        } else if (Array.isArray(onChange)) {
          onChange.forEach(fn => fn(selectedDates, dateStr, instance));
        }
      },
      onReady: (_, __, inst) => {
        if (inst?.calendarContainer)
          inst.calendarContainer.style.zIndex = "100000";
      },
      onOpen: (_, __, inst) => {
        if (inst?.calendarContainer)
          inst.calendarContainer.style.zIndex = "100000";
      },
    });

    fpRef.current = fp;
    return () => {
      fp.destroy();
      fpRef.current = null;
    };
  }, [id, mode, onChange]);

  // Keep picker synced with React value
  useEffect(() => {
    if (!fpRef.current) return;
    if (!value) fpRef.current.clear();
    else fpRef.current.setDate(new Date(`${String(value).split("T")[0]}T12:00:00`), false);
  }, [value]);

  const handleClick = () => {
    if (!disabled) fpRef.current?.open();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fpRef.current) {
      fpRef.current.clear();
      fpRef.current.close();

      // Notify parent (same as ReferenceSelector)
      if (typeof onChange === "function") onChange([], "", fpRef.current);
      else if (Array.isArray(onChange))
        onChange.forEach(fn => fn([], "", fpRef.current!));
    }
  };

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div onClick={handleClick} className="cursor-pointer group">
        <TextField
          id={id}
          fullWidth
          size="small"
          variant="outlined"
          placeholder={placeholder}
          error={error}
          helperText={hint || ""}
          disabled={disabled}
          required={required}
          sx={{
            "& .MuiOutlinedInput-root": {
              paddingRight: "6px",
            },
          }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  {!required && value && (
                    <IconButton
                      onClick={handleClear}
                      size="small"
                      tabIndex={-1}
                      sx={{
                        opacity: 0,
                        transition: "opacity 0.2s ease",
                        ".group:hover &": { opacity: 1 },
                      }}
                    >
                      <CloseLineIcon className="size-4 text-gray-500" />
                    </IconButton>
                  )}
                    <IconButton size="small">
                      <CalendarIcon className="size-6 text-gray-500" />
                    </IconButton>
                </InputAdornment>
              ),
              readOnly: true,
            },
          }}
        />
      </div>
    </div>
  );
}
