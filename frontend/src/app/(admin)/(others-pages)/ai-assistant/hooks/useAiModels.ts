// app/(admin)/(others-pages)/ai-assistant/hooks/useAiModels.ts
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { AiModelsService } from "@/api/services/AiModelsService";
import { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isModelAccessible } from "../components/ModelSelect";

// Helper function to get common resolutions when "any" is supported
const getCommonResolutions = (maxResolution?: string) => {
  const baseResolutions = [
    "512x512",
    "768x768",
    "1024x1024",
    "1280x720",
    "720x1280",
    "1792x1024",
    "1024x1792",
    "1024x1536",
    "1536x1024",
  ];

  if (!maxResolution) {
    return baseResolutions;
  }

  const [maxWidth, maxHeight] = maxResolution.split("x").map(Number);
  const filtered = baseResolutions.filter((res) => {
    const [width, height] = res.split("x").map(Number);
    return width <= maxWidth && height <= maxHeight;
  });

  const maxResSquare = `${maxWidth}x${maxHeight}`;
  const maxResLandscape = `${maxWidth}x${maxHeight}`;
  const maxResPortrait = `${maxHeight}x${maxWidth}`;

  if (!filtered.includes(maxResSquare)) {
    filtered.push(maxResSquare);
  }
  if (maxWidth !== maxHeight && !filtered.includes(maxResLandscape)) {
    filtered.push(maxResLandscape);
  }
  if (maxWidth !== maxHeight && !filtered.includes(maxResPortrait)) {
    filtered.push(maxResPortrait);
  }

  return filtered;
};

// Helper function to get available resolutions for a model
export const getAvailableResolutions = (model: AiModel | null): string[] => {
  if (!model?.params?.supported_resolutions) {
    return ["1024x1024"];
  }

  const supported = model.params.supported_resolutions as string[];
  if (supported.includes("any")) {
    const maxRes = model.params.max_resolution as string | undefined;
    return getCommonResolutions(maxRes);
  }

  return supported;
};

// Helper function to get available quality options for a model
export const getAvailableQuality = (model: AiModel | null): string[] => {
  if (!model?.params?.quality) {
    return ["standard"];
  }
  return model.params.quality as string[];
};

interface UseAiModelsOptions {
  mode: "chat" | "image-gen";
  userTier: number | null | undefined;
}

interface UseAiModelsReturn {
  aiModels: AiModel[];
  aiModelsRef: React.MutableRefObject<AiModel[]>;
  selectedModel: AiModel | null;
  setSelectedModel: (model: AiModel | null) => void;
  selectedModelId: string | null;
  setSelectedModelId: (id: string | null) => void;
  selectedModelIdRef: React.MutableRefObject<string | null>;
  chatModelId: string | null;
  setChatModelId: (id: string | null) => void;
  imageModelId: string | null;
  setImageModelId: (id: string | null) => void;
  isLoadingModels: boolean;
  isInitialLoad: boolean;
  imageResolution: string;
  setImageResolution: (resolution: string) => void;
  imageResolutionRef: React.MutableRefObject<string>;
  imageQuality: string;
  setImageQuality: (quality: string) => void;
  imageQualityRef: React.MutableRefObject<string>;
  imageCount: number;
  setImageCount: (count: number) => void;
  imageCountRef: React.MutableRefObject<number>;
  reasoning: boolean;
  setReasoning: (reasoning: boolean) => void;
  reasoningRef: React.MutableRefObject<boolean>;
  handleModelChange: (modelId: string) => void;
  getAvailableResolutions: typeof getAvailableResolutions;
  getAvailableQuality: typeof getAvailableQuality;
}

export function useAiModels({ mode, userTier }: UseAiModelsOptions): UseAiModelsReturn {
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [chatModelId, setChatModelId] = useLocalStorage<string | null>("chat_model_id", null);
  const [imageModelId, setImageModelId] = useLocalStorage<string | null>("image_model_id", null);
  const [selectedModel, setSelectedModel] = useState<AiModel | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [imageResolution, setImageResolution] = useState<string>("1024x1024");
  const [imageQuality, setImageQuality] = useState<string>("standard");
  const [imageCount, setImageCount] = useState<number>(1);
  const [reasoning, setReasoning] = useLocalStorage<boolean>("chat_reasoning", false);

  const aiModelsRef = useRef<AiModel[]>([]);
  const selectedModelIdRef = useRef<string | null>(null);
  const imageResolutionRef = useRef<string>("1024x1024");
  const imageQualityRef = useRef<string>("standard");
  const imageCountRef = useRef<number>(1);
  const reasoningRef = useRef<boolean>(false);

  const selectedModelId = mode === "chat" ? chatModelId : imageModelId;
  const setSelectedModelId = mode === "chat" ? setChatModelId : setImageModelId;

  // Fetch models
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsLoadingModels(true);
        const filters =
          mode === "chat"
            ? JSON.stringify({ $and: [{ completion: true }, { enabled: true }] })
            : JSON.stringify({ $and: [{ image_generation: true }, { enabled: true }] });
        const models = await AiModelsService.listItemsAdminAiModelsGet(0, 100, filters);

        const sortedModels = [...models].sort((a, b) => {
          const providerCompare = a.service.localeCompare(b.service);
          if (providerCompare !== 0) return providerCompare;
          return a.name.localeCompare(b.name);
        });

        setAiModels(sortedModels);
        aiModelsRef.current = sortedModels;

        // Only run model selection logic once userTier is loaded (not undefined)
        if (models.length > 0 && userTier !== undefined) {
          const getBestDefaultModel = () => {
            const accessibleModels = models.filter((m) => isModelAccessible(m, userTier));
            const sortedByRank = [...accessibleModels].sort((a, b) => {
              const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
              const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
              return rankA - rankB;
            });
            return sortedByRank.length > 0 ? sortedByRank[0] : null;
          };

          const localStorageKey = mode === "chat" ? "chat_model_id" : "image_model_id";
          const rawValue = localStorage.getItem(localStorageKey);
          const savedModelId = rawValue?.replace(/^"|"$/g, "") || null;

          if (savedModelId) {
            const savedModel = models.find((m) => m._id === savedModelId);
            const isAccessible = savedModel ? isModelAccessible(savedModel, userTier) : false;
            if (savedModel && isAccessible) {
              setSelectedModel(savedModel);
            } else {
              const bestModel = getBestDefaultModel();
              if (bestModel) {
                setSelectedModelId(bestModel._id as string);
                setSelectedModel(bestModel);
              }
            }
          } else {
            const bestModel = getBestDefaultModel();
            if (bestModel) {
              setSelectedModelId(bestModel._id as string);
              setSelectedModel(bestModel);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch AI models:", err);
        toast.error("Failed to load AI models");
      } finally {
        setIsLoadingModels(false);
        setIsInitialLoad(false);
      }
    };

    fetchModels();
  }, [mode, userTier]);

  // Update image settings when model changes
  useEffect(() => {
    if (selectedModel && mode === "image-gen") {
      const defaultRes = selectedModel.params?.default_resolution as string | undefined;
      const availableRes = getAvailableResolutions(selectedModel);
      const availableQual = getAvailableQuality(selectedModel);

      setImageResolution(defaultRes || availableRes[0]);
      setImageQuality(availableQual[0]);
    }
  }, [selectedModel, mode]);

  // Keep refs in sync
  useEffect(() => {
    selectedModelIdRef.current = selectedModelId;
  }, [selectedModelId]);

  useEffect(() => {
    imageResolutionRef.current = imageResolution;
  }, [imageResolution]);

  useEffect(() => {
    imageQualityRef.current = imageQuality;
  }, [imageQuality]);

  useEffect(() => {
    imageCountRef.current = imageCount;
  }, [imageCount]);

  useEffect(() => {
    reasoningRef.current = reasoning;
  }, [reasoning]);

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    const model = aiModels.find((m) => m._id === modelId);
    if (model) setSelectedModel(model);
  };

  return {
    aiModels,
    aiModelsRef,
    selectedModel,
    setSelectedModel,
    selectedModelId,
    setSelectedModelId,
    selectedModelIdRef,
    chatModelId,
    setChatModelId,
    imageModelId,
    setImageModelId,
    isLoadingModels,
    isInitialLoad,
    imageResolution,
    setImageResolution,
    imageResolutionRef,
    imageQuality,
    setImageQuality,
    imageQualityRef,
    imageCount,
    setImageCount,
    imageCountRef,
    reasoning,
    setReasoning,
    reasoningRef,
    handleModelChange,
    getAvailableResolutions,
    getAvailableQuality,
  };
}
