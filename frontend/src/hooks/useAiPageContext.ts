"use client";
import { useEffect, useRef } from "react";
import { useAiPanel } from "@/context/AiPanelContext";

interface UseAiPageContextOptions {
  /** JSON / text describing what the current page is displaying */
  context: string;
  /** Custom system prompt; leave empty to use the generic in-page template */
  systemPrompt?: string;
  /**
   * Set to false to prevent this instance from publishing or clearing context.
   * Use this for sub-entity sections that should not override the primary entity's context.
   * Defaults to true.
   */
  enabled?: boolean;
}

/**
 * Call this inside any entity / calendar / page component to publish its
 * current data into the in-page AI assistant panel.
 *
 * The context is automatically cleared when the component unmounts (navigating
 * away from the page).
 */
export function useAiPageContext({ context, systemPrompt = "", enabled = true }: UseAiPageContextOptions) {
  const { setPageAiData } = useAiPanel();
  // Track whether this instance is still mounted so we don't race with the
  // next page's mount when clearing.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setPageAiData({ context, systemPrompt });
  }, [context, systemPrompt, setPageAiData, enabled]);

  // Clear context when this component unmounts
  useEffect(() => {
    return () => {
      // Small timeout so that if the next page mounts immediately it wins
      setTimeout(() => {
        if (!mountedRef.current && enabled) {
          setPageAiData({ context: "", systemPrompt: "" });
        }
      }, 0);
    };
  }, [setPageAiData, enabled]);
}
