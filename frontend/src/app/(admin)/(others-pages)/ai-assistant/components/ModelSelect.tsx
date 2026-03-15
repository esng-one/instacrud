import React, { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";

interface ModelSelectProps {
  models: AiModel[];
  selectedModelId: string | null;
  onChange: (modelId: string) => void;
  userTier?: number | null;
}

const GRAYSCALE_SERVICES = ["OPEN_AI", "DEEP_INFRA"];
const INVERT_SERVICES = ["OPEN_AI", "CLAUDE", "OLLAMA", "DEEP_INFRA"];

// Get credit indicator emoji based on credit cost
const getCreditIndicator = (credits: number): string => {
  if (credits <= 30) return "🟢"; // Green - cheap
  if (credits <= 200) return "🟡"; // Yellow - moderate
  return "🟠"; // Orange - expensive
};

// Check if model is accessible based on user tier
// userTier: undefined = not yet loaded, null = unlimited access, number = actual tier
export const isModelAccessible = (model: AiModel, userTier?: number | null): boolean => {
  // If model has no tier requirement, it's accessible to everyone
  if (model.tier === null || model.tier === undefined) return true;
  // If user tier is not yet loaded (undefined), be restrictive (default to tier 1)
  if (userTier === undefined) return 1 >= model.tier;
  // If user has no tier (null), they have unlimited access
  if (userTier === null) return true;
  // User tier must be >= model tier
  return userTier >= model.tier;
};

export const ModelSelect: React.FC<ModelSelectProps> = ({
  models,
  selectedModelId,
  onChange,
  userTier,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m._id === selectedModelId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative w-full sm:flex-1 sm:max-w-[16rem]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2 text-sm text-gray-900 shadow-sm
                   focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                   dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-brand-400
                   flex items-center justify-between gap-2"
      >
        <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5">
          {selectedModel?.icon && (
            <img src={selectedModel.icon} alt="" className={`w-4 h-4 flex-shrink-0 object-contain${INVERT_SERVICES.includes(selectedModel.service) ? " dark:invert" : ""}${GRAYSCALE_SERVICES.includes(selectedModel.service) ? " grayscale" : ""}`} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          {selectedModel?.name || "Select model"}
          {selectedModel?.image_completion ? " 👁️" : ""}
          {selectedModel?.credits && (
            <span className="text-xs text-gray-500 dark:text-gray-400"> (<span className="text-[0.65rem]">{getCreditIndicator(selectedModel.credits)}</span>{selectedModel.credits})</span>
          )}
        </span>
        <ChevronDownIcon className="w-4 h-4 flex-shrink-0 transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-300 bg-white shadow-lg
                        dark:border-gray-700 dark:bg-gray-800 max-h-60 overflow-y-auto">
          {models.map((model) => {
            const accessible = isModelAccessible(model, userTier);
            return (
              <div
                key={model._id}
                className="relative"
                onMouseEnter={() => !accessible && setHoveredModelId(model._id as string)}
                onMouseLeave={() => setHoveredModelId(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (accessible) {
                      onChange(model._id as string);
                      setIsOpen(false);
                    }
                  }}
                  disabled={!accessible}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2
                             ${selectedModelId === model._id ? "bg-brand-50 dark:bg-brand-900/20" : ""}
                             ${accessible
                               ? "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
                               : "text-gray-300 dark:text-gray-600 cursor-no-drop"}`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    {model.icon && (
                      <img src={model.icon} alt="" className={`w-4 h-4 flex-shrink-0 object-contain${INVERT_SERVICES.includes(model.service) ? " dark:invert" : ""}${GRAYSCALE_SERVICES.includes(model.service) ? " grayscale" : ""}`} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    {model.name}
                    {model.image_completion ? " 👁️" : ""}
                  </span>
                  {model.credits && (
                    <span className={`text-xs flex-shrink-0 ml-2 ${accessible ? "text-gray-500 dark:text-gray-400" : ""}`}>
                      (<span className="text-[0.65rem]">{getCreditIndicator(model.credits)}</span>{model.credits})
                    </span>
                  )}
                </button>
                {!accessible && hoveredModelId === model._id && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded shadow-lg text-center z-[60]">
                    Please upgrade to a higher tier<br />to use this model
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
