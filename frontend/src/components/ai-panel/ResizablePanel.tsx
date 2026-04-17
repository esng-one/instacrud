"use client";
import React, { useRef, useState, useCallback, useEffect } from "react";

interface ResizablePanelProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Initial left pane width as a percentage (default 66.7) */
  initialLeftPercent?: number;
  /** Min/max clamp for the left pane (default 25–80) */
  minLeftPercent?: number;
  maxLeftPercent?: number;
}

/**
 * Two-pane horizontal split with a draggable divider.
 * Left side shows the main page content; right side shows the AI panel.
 */
export function ResizablePanel({
  left,
  right,
  initialLeftPercent = 66.7,
  minLeftPercent = 25,
  maxLeftPercent = 80,
}: ResizablePanelProps) {
  const [leftPercent, setLeftPercent] = useState(initialLeftPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const raw = ((ev.clientX - rect.left) / rect.width) * 100;
        setLeftPercent(Math.min(maxLeftPercent, Math.max(minLeftPercent, raw)));
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [minLeftPercent, maxLeftPercent]
  );

  // Clean up body styles if component unmounts mid-drag
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <div ref={containerRef} className="flex w-full h-full overflow-hidden">
      {/* Left pane */}
      <div
        style={{ width: `${leftPercent}%` }}
        className="overflow-y-auto overflow-x-hidden flex-shrink-0"
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        className="w-1 flex-shrink-0 bg-gray-200 dark:bg-gray-700 hover:bg-brand-500 dark:hover:bg-brand-400 cursor-col-resize transition-colors"
        onMouseDown={onMouseDown}
        title="Drag to resize"
      />

      {/* Right pane */}
      <div className="flex-1 overflow-hidden border-l border-gray-200 dark:border-gray-800 min-w-0">
        {right}
      </div>
    </div>
  );
}
