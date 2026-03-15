// components/common/ImagePreviewModal.tsx
"use client";
import { Modal } from "@/components/ui/modal";
import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";

export function ImagePreviewModal({
  open,
  onClose,
  imageUrl,
  title = "Image Preview",
}: {
  open: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
}) {
  const [fitToWindow, setFitToWindow] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [buttonsOverlapImage, setButtonsOverlapImage] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  // Reset state when modal is closed
  useEffect(() => {
    if (!open) {
      setFitToWindow(true);
      setIsDragging(false);
      setScrollPos({ x: 0, y: 0 });
      setIsOverflowing(false);
      setZoom(1);
      setButtonsOverlapImage(false);
    }
  }, [open]);

  // Update image dimensions when zoom changes
  useEffect(() => {
    if (!fitToWindow && imageRef.current && imageRef.current.naturalWidth) {
      const img = imageRef.current;
      img.style.width = `${img.naturalWidth * zoom}px`;
      img.style.height = `${img.naturalHeight * zoom}px`;
      img.style.willChange = 'transform';
    }
  }, [zoom, fitToWindow]);

  // Check if image is overflowing
  useEffect(() => {
    if (!fitToWindow && containerRef.current && imageRef.current) {
      const container = containerRef.current;
      const image = imageRef.current;
      const scaledWidth = image.naturalWidth * zoom;
      const scaledHeight = image.naturalHeight * zoom;
      const isOverflow = scaledWidth > container.clientWidth || scaledHeight > container.clientHeight;
      setIsOverflowing(isOverflow);
    } else {
      setIsOverflowing(false);
    }
  }, [fitToWindow, imageUrl, zoom]);

  // Check if buttons overlap with image
  useEffect(() => {
    const checkOverlap = () => {
      if (!buttonsRef.current || !imageRef.current || !containerRef.current || !open) {
        setButtonsOverlapImage(false);
        return;
      }

      const buttonsRect = buttonsRef.current.getBoundingClientRect();
      const image = imageRef.current;
      let imageRect = image.getBoundingClientRect();

      // In fit-to-window mode with object-fit: contain, we need to calculate the actual rendered image size
      if (fitToWindow && image.naturalWidth && image.naturalHeight) {
        const containerRect = imageRect;
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const imageAspect = image.naturalWidth / image.naturalHeight;
        const containerAspect = containerWidth / containerHeight;

        let renderedWidth, renderedHeight;
        if (imageAspect > containerAspect) {
          // Image is wider - width constrained
          renderedWidth = containerWidth;
          renderedHeight = containerWidth / imageAspect;
        } else {
          // Image is taller - height constrained
          renderedHeight = containerHeight;
          renderedWidth = containerHeight * imageAspect;
        }

        // Calculate centered position
        const left = containerRect.left + (containerWidth - renderedWidth) / 2;
        const top = containerRect.top + (containerHeight - renderedHeight) / 2;

        imageRect = {
          left,
          right: left + renderedWidth,
          top,
          bottom: top + renderedHeight,
          width: renderedWidth,
          height: renderedHeight,
          x: left,
          y: top,
          toJSON: () => ({})
        } as DOMRect;
      }

      // Check if rectangles overlap
      const overlap = !(
        buttonsRect.right < imageRect.left ||
        buttonsRect.left > imageRect.right ||
        buttonsRect.bottom < imageRect.top ||
        buttonsRect.top > imageRect.bottom
      );

      setButtonsOverlapImage(overlap);
    };

    if (!open) {
      setButtonsOverlapImage(false);
      return;
    }

    // Check overlap after delays to ensure layout is settled
    const timeoutId1 = setTimeout(checkOverlap, 50);
    const timeoutId2 = setTimeout(checkOverlap, 200);
    const timeoutId3 = setTimeout(checkOverlap, 500);

    // Also check on scroll/resize events
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', checkOverlap);
    }
    window.addEventListener('resize', checkOverlap);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      if (container) {
        container.removeEventListener('scroll', checkOverlap);
      }
      window.removeEventListener('resize', checkOverlap);
    };
  }, [fitToWindow, imageUrl, zoom, scrollPos, open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isOverflowing || fitToWindow) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - scrollPos.x,
      y: e.clientY - scrollPos.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const newScrollPos = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    };
    setScrollPos(newScrollPos);
    containerRef.current.scrollLeft = -newScrollPos.x;
    containerRef.current.scrollTop = -newScrollPos.y;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    // Stop dragging when mouse leaves, but keep tracking mouse button state
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleMouseEnter = () => {
    // Don't re-enable dragging when mouse re-enters
    // User must release and press again to start dragging
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const container = containerRef.current;
    const image = imageRef.current;

    if (!container || !image) return;

    // If in fit-to-window mode, switch to zoom mode first
    if (fitToWindow) {
      setFitToWindow(false);
      // Let the zoom state update in the next render
      return;
    }

    // Zoom in: increment by 0.5 (1, 1.5, 2, 2.5, ..., 10)
    // Zoom out: decrement as fractions (1, 1/2, 1/3, 1/4, ..., 1/10)
    let newZoom: number;
    if (e.deltaY < 0) {
      // Zoom in
      if (zoom < 1) {
        // Currently at 1/n, go to 1/(n-1)
        const denominator = Math.round(1 / zoom);
        if (denominator <= 2) {
          // If at 1/2, go to 1
          newZoom = 1;
        } else {
          // Go to 1/(n-1)
          const nextDenominator = denominator - 1;
          newZoom = 1 / nextDenominator;
        }
      } else {
        // Increment by 0.5
        newZoom = Math.min(10, zoom + 0.5);
      }
    } else {
      // Zoom out
      if (zoom > 1) {
        // Decrement by 0.5
        newZoom = Math.max(1, zoom - 0.5);
      } else if (zoom === 1) {
        // Go to 1/2
        newZoom = 1/2;
      } else {
        // Currently at 1/n, go to 1/(n+1)
        const denominator = Math.round(1 / zoom);
        const nextDenominator = Math.min(10, denominator + 1);
        newZoom = 1 / nextDenominator;
      }
    }

    if (newZoom === zoom) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate if image is bigger than viewport at current zoom
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    const currentWidth = naturalWidth * zoom;
    const currentHeight = naturalHeight * zoom;
    const newWidth = naturalWidth * newZoom;
    const newHeight = naturalHeight * newZoom;

    const isCurrentlyOverflowing = currentWidth > container.clientWidth || currentHeight > container.clientHeight;
    const willBeOverflowing = newWidth > container.clientWidth || newHeight > container.clientHeight;

    if (isCurrentlyOverflowing && willBeOverflowing) {
      // Zoom around mouse pointer
      const scrollLeft = container.scrollLeft;
      const scrollTop = container.scrollTop;

      // Point in image coordinates
      const imageX = scrollLeft + mouseX;
      const imageY = scrollTop + mouseY;

      // Scale factor
      const scale = newZoom / zoom;

      // New scroll position to keep the same point under the mouse
      const newScrollLeft = imageX * scale - mouseX;
      const newScrollTop = imageY * scale - mouseY;

      // Update image size synchronously before changing zoom state
      if (image.naturalWidth) {
        image.style.width = `${image.naturalWidth * newZoom}px`;
        image.style.height = `${image.naturalHeight * newZoom}px`;
      }

      setZoom(newZoom);

      // Immediately update scroll position without waiting for next frame
      container.scrollLeft = newScrollLeft;
      container.scrollTop = newScrollTop;
      setScrollPos({ x: -newScrollLeft, y: -newScrollTop });
    } else {
      // Image is smaller than viewport or will be, just update zoom
      // The centering is handled by CSS flex properties
      setZoom(newZoom);
      if (!willBeOverflowing) {
        // Reset scroll position when image becomes smaller than viewport
        setScrollPos({ x: 0, y: 0 });
        if (container) {
          container.scrollLeft = 0;
          container.scrollTop = 0;
        }
      }
    }
  };

  const handleCopyImage = async () => {
    if (!imageUrl) return;

    try {
      // All images are now base64 data URLs, so we can directly fetch them
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      toast.success('Image copied to clipboard');
    } catch (err) {
      console.error('Failed to copy image:', err);
      toast.error('Failed to copy image');
    }
  };

  const handleDownloadImage = async () => {
    if (!imageUrl) return;

    try {
      // All images are now base64 data URLs, so we can directly download them
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Image downloaded');
    } catch (err) {
      console.error('Failed to download image:', err);
      toast.error('Failed to download image');
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      className="!w-[90vw] !h-[90vh] p-0 bg-white dark:bg-gray-900 rounded-xl flex flex-col"
      showCloseButton
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="p-4 overflow-auto h-full"
          style={{
            display: fitToWindow || !isOverflowing ? 'flex' : 'block',
            justifyContent: fitToWindow || !isOverflowing ? 'center' : 'unset',
            alignItems: fitToWindow || !isOverflowing ? 'center' : 'unset',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            cursor: !fitToWindow && isOverflowing ? (isDragging ? 'grabbing' : 'grab') : 'default',
            overflowX: 'hidden',
            overflowY: 'hidden'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseEnter={handleMouseEnter}
          onWheel={handleWheel}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {imageUrl ? (
            <>
              <img
                ref={imageRef}
                src={imageUrl}
                alt="preview"
                className="rounded-lg"
                style={fitToWindow ? {
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  userSelect: 'none'
                } : {
                  maxWidth: 'none',
                  maxHeight: 'none',
                  imageRendering: 'auto',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
                draggable={false}
                onLoad={(e) => {
                  if (!fitToWindow && imageRef.current) {
                    const img = e.currentTarget;
                    img.style.width = `${img.naturalWidth * zoom}px`;
                    img.style.height = `${img.naturalHeight * zoom}px`;
                  }

                  // Check overlap after image loads
                  setTimeout(() => {
                    if (buttonsRef.current && imageRef.current && containerRef.current) {
                      const buttonsRect = buttonsRef.current.getBoundingClientRect();
                      const image = imageRef.current;
                      let imageRect = image.getBoundingClientRect();

                      // In fit-to-window mode with object-fit: contain, calculate actual rendered image size
                      if (fitToWindow && image.naturalWidth && image.naturalHeight) {
                        const containerRect = imageRect;
                        const containerWidth = containerRect.width;
                        const containerHeight = containerRect.height;
                        const imageAspect = image.naturalWidth / image.naturalHeight;
                        const containerAspect = containerWidth / containerHeight;

                        let renderedWidth, renderedHeight;
                        if (imageAspect > containerAspect) {
                          renderedWidth = containerWidth;
                          renderedHeight = containerWidth / imageAspect;
                        } else {
                          renderedHeight = containerHeight;
                          renderedWidth = containerHeight * imageAspect;
                        }

                        const left = containerRect.left + (containerWidth - renderedWidth) / 2;
                        const top = containerRect.top + (containerHeight - renderedHeight) / 2;

                        imageRect = {
                          left,
                          right: left + renderedWidth,
                          top,
                          bottom: top + renderedHeight,
                          width: renderedWidth,
                          height: renderedHeight,
                          x: left,
                          y: top,
                          toJSON: () => ({})
                        } as DOMRect;
                      }

                      const overlap = !(
                        buttonsRect.right < imageRect.left ||
                        buttonsRect.left > imageRect.right ||
                        buttonsRect.bottom < imageRect.top ||
                        buttonsRect.top > imageRect.bottom
                      );
                      setButtonsOverlapImage(overlap);
                    }
                  }, 100);
                }}
              />
            </>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-sm">No image</div>
          )}
        </div>

        {/* Fixed buttons in top-right corner */}
        {imageUrl && (
          <div
            ref={buttonsRef}
            className={`absolute top-6 right-6 flex gap-1 z-10 ${
              buttonsOverlapImage ? 'opacity-0 hover:opacity-100 transition-opacity' : 'opacity-100'
            }`}
            style={{ pointerEvents: 'auto' }}
          >
            <button
              onClick={handleCopyImage}
              className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded p-1.5 shadow-sm transition-colors"
              title="Copy image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={handleDownloadImage}
              className="bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded p-1.5 shadow-sm transition-colors"
              title="Download image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={() => setFitToWindow(true)}
              className={`rounded p-1.5 shadow-sm transition-colors ${
                fitToWindow
                  ? "bg-brand-500 text-white hover:bg-brand-600"
                  : "bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
              title="Fit to window"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={() => {
                setFitToWindow(false);
                setZoom(1);
                setScrollPos({ x: 0, y: 0 });
                if (containerRef.current) {
                  containerRef.current.scrollLeft = 0;
                  containerRef.current.scrollTop = 0;
                }
              }}
              className={`rounded p-1.5 shadow-sm transition-colors ${
                !fitToWindow && zoom === 1
                  ? "bg-brand-500 text-white hover:bg-brand-600"
                  : "bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
              title="Actual size"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
