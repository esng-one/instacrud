import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import toast from "react-hot-toast";
import { imageToBase64 } from "../utils/imageUtils";
import { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";
import useSpeechToText from "@/hooks/useSpeechRecognition";

interface ChatInputProps {
  input: string;
  attachedImage: { data: string; url: string } | null;
  isLoading: boolean;
  selectedModelId: string | null;
  selectedModel: AiModel | null;
  mode: "chat" | "image-gen";
  /** Always use the stacked (two-row) layout regardless of viewport width */
  compact?: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStopGeneration: () => void;
  onImageAttach: (image: { data: string; url: string }) => void;
  onImageRemove: () => void;
}

export interface ChatInputHandle {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({
  input,
  attachedImage,
  isLoading,
  selectedModelId,
  selectedModel,
  mode,
  compact = false,
  onInputChange,
  onSubmit,
  onStopGeneration,
  onImageAttach,
  onImageRemove,
}, ref) => {
  const iconSize = compact ? "w-4 h-4" : "w-5 h-5";
  const btnPad  = compact ? "p-1.5"   : "p-2";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isListening, transcript, startListening, stopListening } =
    useSpeechToText({ continuous: true });

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }
  }, [input]);

  const stopVoiceInput = useCallback(() => {
    if (transcript.length) {
      onInputChange(transcript);
    }
    stopListening();
  }, [transcript, onInputChange, stopListening]);

  // Stop voice input when loading starts
  useEffect(() => {
    if (isLoading) {
      stopVoiceInput();
    }
  }, [isLoading, stopVoiceInput]);

  const handleListenClick = () => {
    if (isListening) {
      stopVoiceInput();
    } else {
      startListening();
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    try {
      const base64Data = await imageToBase64(file);
      const imageUrl = URL.createObjectURL(file);
      onImageAttach({ data: base64Data, url: imageUrl });
    } catch (err) {
      console.error('Failed to process image:', err);
      toast.error('Failed to process image');
    }
  };

  const handleRemoveImage = () => {
    if (attachedImage?.url) {
      URL.revokeObjectURL(attachedImage.url);
    }
    onImageRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChangeInternal = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Limit to 15 lines (assuming ~24px per line with padding)
      const maxHeight = 360; // approximately 15 lines
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = newHeight + 'px';

      // Show scrollbar only when content exceeds max height
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();

        // Check if model supports image completion
        const supportsImage = selectedModel?.image_completion;
        if (!supportsImage) {
          toast.error("Selected model does not support image input. Please select a vision-capable model.");
          return;
        }

        const file = item.getAsFile();
        if (!file) return;

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error('Image size must be less than 10MB');
          return;
        }

        try {
          const base64Data = await imageToBase64(file);
          const imageUrl = URL.createObjectURL(file);
          onImageAttach({ data: base64Data, url: imageUrl });
        } catch (err) {
          console.error('Failed to process pasted image:', err);
          toast.error('Failed to process pasted image');
        }
        return;
      }
    }
  };

  return (
    <div className={`${compact ? "px-3 pt-2 pb-1.5" : "px-5 pt-4 pb-3"} border-t border-gray-200 dark:border-gray-800 flex-shrink-0`}>
      <div className="max-w-3xl mx-auto">
      {attachedImage && (
        <div className="mb-2 relative inline-block max-w-full">
          <div className="relative rounded-lg overflow-hidden border-2 border-brand-500">
            <img
              src={attachedImage.url}
              alt="Preview"
              className="max-h-48 w-auto max-w-full object-contain"
              style={{ height: 'auto' }}
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600
                       focus:outline-none focus:ring-2 focus:ring-red-500/20"
              aria-label="Remove image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Single rounded container — textarea + buttons inside */}
      <form
        onSubmit={onSubmit}
        className="flex flex-col rounded-3xl border border-gray-300 bg-white shadow-sm
                   focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20
                   disabled:bg-gray-100
                   dark:border-gray-700 dark:bg-gray-800
                   dark:focus-within:border-brand-400"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
          aria-label="Upload image"
        />

        {/* Textarea — grows upward, no own border/bg */}
        <textarea
          ref={textareaRef}
          value={isListening ? (transcript.length ? transcript : "") : input}
          onChange={handleInputChangeInternal}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as any);
            }
          }}
          placeholder={mode === "chat" ? "Type your message..." : "Describe the image..."}
          disabled={isLoading || !selectedModelId}
          rows={1}
          className={`w-full bg-transparent resize-none text-sm text-gray-900
                   placeholder-gray-400 focus:outline-none
                   disabled:text-gray-500 dark:text-white dark:placeholder-gray-500
                   dark:disabled:text-gray-500 overflow-y-hidden
                   min-h-[44px] max-h-[360px] custom-scrollbar [&::-webkit-scrollbar-track]:my-5
                   ${compact ? "px-4 pt-3 pb-1" : "px-5 pt-4 pb-1"}`}
          style={{ height: 'auto', overflowY: 'hidden' }}
        />

        {/* Buttons row — always at bottom */}
        <div className={`flex items-center ${compact ? "px-2 pb-2" : "px-3 pb-3"}`}>
          {/* Image attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              isLoading ||
              !selectedModelId ||
              (mode === "chat" && !selectedModel?.image_completion) ||
              (mode === "image-gen" && !selectedModel?.image_completion)
            }
            className={`rounded-full ${btnPad} text-gray-600 hover:bg-gray-100
                     focus:outline-none focus:ring-2 focus:ring-brand-500/20
                     disabled:text-gray-400 disabled:cursor-not-allowed
                     dark:text-gray-400 dark:hover:bg-gray-700`}
            title={mode === "chat"
              ? (selectedModel?.image_completion ? "Attach image" : "Select a vision model to attach images")
              : (selectedModel?.image_completion ? "Attach reference image for generation" : "This model does not support image input")
            }
          >
            <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Right-side actions */}
          <div className="ml-auto flex items-center gap-1">
            {isLoading ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className={`rounded-full bg-red-500 text-white shadow-sm
                         hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20
                         transition-colors ${btnPad}`}
              >
                <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              </button>
            ) : (
              <>
                {isListening ? (
                  <button
                    type="button"
                    onClick={handleListenClick}
                    disabled={isLoading}
                    className={`rounded-full ${btnPad} text-white
                             bg-blue-500/80 hover:bg-blue-500 focus:outline-none
                             focus:ring-2 focus:ring-blue-500/20 relative transition-colors`}
                    title="Stop recording"
                  >
                    <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="animate-pulse absolute h-[120%] w-[120%] rounded-full bg-blue-500/30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleListenClick}
                    disabled={isLoading}
                    className={`rounded-full ${btnPad} text-gray-600
                             hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                             disabled:text-gray-400 disabled:cursor-not-allowed
                             dark:text-gray-400 dark:hover:bg-gray-700 transition-colors`}
                    title="Start voice input"
                  >
                    <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || !selectedModelId || isListening}
                  className={`rounded-full ${btnPad} text-gray-600 hover:bg-gray-100
                           focus:outline-none focus:ring-2 focus:ring-brand-500/20
                           disabled:text-gray-400 disabled:cursor-not-allowed
                           dark:text-gray-400 dark:hover:bg-gray-700 transition-colors`}
                >
                  <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      <div className={`text-center text-xs text-gray-500 ${compact ? "mt-1" : "mt-2"} leading-tight dark:text-gray-400`}>
        AI can make mistakes. Always verify important information.
      </div>
      </div>
    </div>
  );
});

ChatInput.displayName = "ChatInput";
