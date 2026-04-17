"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

// Paths on which the AI panel button is grayed out / disabled
const EXCLUDED_PATH_PREFIXES = ["/ai-assistant"];

interface AiPanelContextValue {
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  /** JSON / text snapshot of what the current page is displaying */
  pageContext: string;
  /** Custom system prompt from the active page (empty = use generic template) */
  pageSystemPrompt: string;
  /** Called by entity/calendar components to publish their current data */
  setPageAiData: (data: { context?: string; systemPrompt?: string }) => void;
  /** Conversation ID used by the in-page panel */
  panelConversationId: string;
  /** Start a fresh panel conversation */
  newPanelConversation: () => void;
  /** True when the button should be disabled for the given pathname */
  isExcludedPath: (pathname: string) => boolean;
}

const AiPanelContext = createContext<AiPanelContextValue | null>(null);

export function AiPanelProvider({ children }: { children: React.ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [pageContext, setPageContext] = useState("");
  const [pageSystemPrompt, setPageSystemPrompt] = useState("");
  const [panelConversationId, setPanelConversationId] = useState(() => uuidv4());

  const togglePanel = useCallback(() => setIsPanelOpen((prev) => !prev), []);
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const setPageAiData = useCallback(
    ({ context = "", systemPrompt = "" }: { context?: string; systemPrompt?: string }) => {
      setPageContext(context);
      setPageSystemPrompt(systemPrompt);
    },
    []
  );

  const newPanelConversation = useCallback(() => setPanelConversationId(uuidv4()), []);

  const isExcludedPath = useCallback(
    (pathname: string) =>
      EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
    []
  );

  return (
    <AiPanelContext.Provider
      value={{
        isPanelOpen,
        togglePanel,
        openPanel,
        closePanel,
        pageContext,
        pageSystemPrompt,
        setPageAiData,
        panelConversationId,
        newPanelConversation,
        isExcludedPath,
      }}
    >
      {children}
    </AiPanelContext.Provider>
  );
}

export function useAiPanel(): AiPanelContextValue {
  const ctx = useContext(AiPanelContext);
  if (!ctx) throw new Error("useAiPanel must be used within AiPanelProvider");
  return ctx;
}
