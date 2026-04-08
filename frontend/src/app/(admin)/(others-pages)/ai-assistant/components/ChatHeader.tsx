import React from "react";
import { EyeSlashIcon, PlusIcon, LightBulbIcon } from "@heroicons/react/24/outline";
import { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";
import { ConversationHistory } from "./ConversationHistory";
import { ModelSelect } from "./ModelSelect";
import type { LocalConversation } from "@/db/conversationsDb";

const getAspectRatioFrame = (resolution: string): string => {
  const [width, height] = resolution.split('x').map(Number);
  if (width === height) return "◻"; // Square
  if (width > height) return "▭"; // Landscape (horizontal rectangle)
  return "▯"; // Portrait (vertical rectangle)
};

interface ChatHeaderProps {
  isTempMode: boolean;
  conversationTitle: string;
  mode: "chat" | "image-gen";
  aiModels: AiModel[];
  selectedModelId: string | null;
  selectedModel: AiModel | null;
  imageResolution: string;
  imageQuality: string;
  imageCount: number;
  reasoning: boolean;
  attachedImage: { data: string; url: string } | null;
  conversations: LocalConversation[];
  conversationId: string;
  showHistoryDropdown: boolean;
  historyDropdownRef: React.RefObject<HTMLDivElement | null>;
  userTier?: number | null;
  localOnlyConversations?: boolean;
  onModeToggle: () => void;
  onModelChange: (modelId: string) => void;
  onResolutionChange: (resolution: string) => void;
  onQualityChange: (quality: string) => void;
  onCountChange: (count: number) => void;
  onReasoningChange: (reasoning: boolean) => void;
  onNewChat: () => void;
  onTempModeToggle: () => void;
  onHistoryToggle: () => void;
  onDeleteConversation: (id: string) => void;
  onDeleteAllConversations: () => void;
  onResyncData: () => void;
  getAvailableResolutions: (model: AiModel | null) => string[];
  getAvailableQuality: (model: AiModel | null) => string[];
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  isTempMode,
  conversationTitle,
  mode,
  aiModels,
  selectedModelId,
  selectedModel,
  imageResolution,
  imageQuality,
  imageCount,
  reasoning,
  attachedImage,
  conversations,
  conversationId,
  showHistoryDropdown,
  historyDropdownRef,
  userTier,
  localOnlyConversations = false,
  onModeToggle,
  onModelChange,
  onResolutionChange,
  onQualityChange,
  onCountChange,
  onReasoningChange,
  onNewChat,
  onTempModeToggle,
  onHistoryToggle,
  onDeleteConversation,
  onDeleteAllConversations,
  onResyncData,
  getAvailableResolutions,
  getAvailableQuality,
}) => {
  return (
    <div className="p-5 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        {isTempMode || !conversationTitle ? (
          <h1 className="text-lg sm:text-2xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            {isTempMode && <EyeSlashIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
            <span className="hidden sm:inline">{isTempMode ? "Temporary Chat" : "AI Assistant"}</span>
            <span className="sm:hidden">{isTempMode ? "Temp Chat" : "AI Assistant"}</span>
          </h1>
        ) : (
          <h2 className="text-base sm:text-xl font-semibold text-gray-800 dark:text-white truncate max-w-[150px] sm:max-w-none">
            {conversationTitle}
          </h2>
        )}
        <div className="flex items-center gap-2">
          <ConversationHistory
            show={showHistoryDropdown}
            onToggle={onHistoryToggle}
            conversations={conversations}
            currentConversationId={conversationId}
            onDeleteConversation={onDeleteConversation}
            onDeleteAll={onDeleteAllConversations}
            onResyncData={onResyncData}
            dropdownRef={historyDropdownRef}
            localOnlyConversations={localOnlyConversations}
          />
          <button
            onClick={onTempModeToggle}
            className={`h-8 w-8 sm:w-14 text-sm font-medium rounded-md shadow-md transition-colors focus:outline-none focus:ring-2 flex items-center justify-center ${
              isTempMode
                ? "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500/20"
                : "bg-brand-500 text-white hover:bg-brand-600 focus:ring-brand-500/20"
            }`}
            title="Temporary Chat"
          >
            <EyeSlashIcon className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Temp</span>
          </button>
          <button
            onClick={onNewChat}
            className="h-8 w-8 sm:w-14 text-sm font-medium rounded-md bg-brand-500 text-white hover:bg-brand-600 shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20 flex items-center justify-center"
            title="New Chat"
          >
            <PlusIcon className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">New</span>
          </button>
          <button
            onClick={onModeToggle}
            className="relative inline-flex items-center h-10 rounded-lg w-40 bg-gray-200 dark:bg-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <span
              className={`absolute h-8 w-16 rounded-md bg-brand-500 shadow-md transition-transform duration-200 ease-in-out ${
                mode === "image-gen" ? "translate-x-[5.5rem]" : "translate-x-1"
              }`}
            />
            <span
              className={`relative z-10 w-1/2 text-sm font-medium text-center transition-colors duration-200 ${
                mode === "chat" ? "text-white" : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Chat
            </span>
            <span
              className={`relative z-10 w-1/2 text-sm font-medium text-center transition-colors duration-200 ${
                mode === "image-gen" ? "text-white" : "text-gray-700 dark:text-gray-300"
              }`}
            >
              Image
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap sm:flex-nowrap min-h-[42px]">
        {/* Model Select */}
        <div className="relative flex-1 min-w-[120px] max-w-[200px] sm:contents">
          <label
            className="absolute -top-2 left-2 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 z-10 sm:static sm:text-sm sm:bg-transparent sm:dark:bg-transparent sm:px-0 sm:text-gray-700 sm:dark:text-gray-300"
          >
            Model<span className="hidden sm:inline">:</span>
          </label>
          <ModelSelect
            models={aiModels}
            selectedModelId={selectedModelId}
            onChange={onModelChange}
            userTier={userTier}
          />
        </div>

        {/* Reasoning Toggle - only show for chat mode with reasoning-capable models */}
        {mode === "chat" && selectedModel?.reasoning && (
          <button
            type="button"
            title={reasoning ? "Reasoning enabled" : "Enable reasoning"}
            aria-label="Toggle reasoning"
            aria-pressed={reasoning}
            onClick={() => onReasoningChange(!reasoning)}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-lg text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/20 border ${
              reasoning
                ? "bg-brand-500 text-white hover:bg-brand-600 border-brand-500"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-700"
            }`}
          >
            <LightBulbIcon className="h-5 w-5" />
          </button>
        )}

        {mode === "image-gen" && selectedModel?.params && (
          <>
            {/* Size Select */}
            <div className="relative min-w-[100px] max-w-[140px] sm:contents">
              <label
                htmlFor="resolution-select"
                className="absolute -top-2 left-2 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 z-10 sm:static sm:text-sm sm:bg-transparent sm:dark:bg-transparent sm:px-0 sm:text-gray-700 sm:dark:text-gray-300"
              >
                Size<span className="hidden sm:inline">:</span>
              </label>
              <select
                id="resolution-select"
                value={imageResolution}
                onChange={(e) => onResolutionChange(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm
                         focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                         dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-brand-400"
              >
                {getAvailableResolutions(selectedModel).map((res) => (
                  <option key={res} value={res}>
                    {getAspectRatioFrame(res)} {res}
                  </option>
                ))}
              </select>
            </div>

            {selectedModel.params.quality && (
              <div className="relative min-w-[90px] max-w-[120px] sm:contents">
                <label
                  htmlFor="quality-select"
                  className="absolute -top-2 left-2 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 z-10 sm:static sm:text-sm sm:bg-transparent sm:dark:bg-transparent sm:px-0 sm:text-gray-700 sm:dark:text-gray-300"
                >
                  Quality<span className="hidden sm:inline">:</span>
                </label>
                <select
                  id="quality-select"
                  value={imageQuality}
                  onChange={(e) => onQualityChange(e.target.value)}
                  className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm
                           focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                           dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-brand-400"
                >
                  {getAvailableQuality(selectedModel).map((quality) => (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Count Select */}
            <div className="relative min-w-[70px] max-w-[90px] sm:contents">
              <label
                htmlFor="count-select"
                className="absolute -top-2 left-2 px-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 z-10 sm:static sm:text-sm sm:bg-transparent sm:dark:bg-transparent sm:px-0 sm:text-gray-700 sm:dark:text-gray-300"
              >
                Count<span className="hidden sm:inline">:</span>
              </label>
              <select
                id="count-select"
                value={imageCount}
                onChange={(e) => onCountChange(Number(e.target.value))}
                className="w-full sm:w-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm
                         focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                         dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-brand-400"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {attachedImage && !selectedModel?.image_completion && (
          <span className="text-xs text-amber-600 dark:text-amber-400" title="Image attached - select a vision model">
            ⚠️ Vision model required
          </span>
        )}
      </div>
    </div>
  );
};
