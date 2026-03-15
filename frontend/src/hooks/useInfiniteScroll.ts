// hooks/useInfiniteScroll.ts
import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";

interface UseInfiniteScrollOptions<T> {
  fetchPage: (skip: number, limit: number) => Promise<T[]>;
  pageSize?: number;
}

export function useInfiniteScroll<T>({
  fetchPage,
  pageSize = 10,
}: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLDivElement | null>(null);
  const skipRef = useRef(0);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    try {
      const skip = skipRef.current;
      const result = await fetchPage(skip, pageSize + 1);

      const hasMoreItems = result.length > pageSize;
      const newItems = result.slice(0, pageSize);

      skipRef.current += newItems.length;
      setItems((prev) => [...prev, ...newItems]);
      setHasMore(hasMoreItems);
    } catch (error) {
      toast.error("Error loading more data");
      console.error("Infinite scroll fetch error:", error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoading(false);
    }
  }, [hasMore, fetchPage, pageSize]);

  // Set up intersection observer
  useEffect(() => {
    if (loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    if (lastElementRef.current) {
      observer.observe(lastElementRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadMore]);

  // Initial load
  useEffect(() => {
    if (items.length === 0 && !loading) {
      loadMore();
    }
  }, []);

  const refetch = useCallback(() => {
    skipRef.current = 0;
    loadingRef.current = false;
    setItems([]);
    setHasMore(true);
    setInitialLoading(true);
  }, []);

  return {
    items,
    loading,
    hasMore,
    initialLoading,
    lastElementRef,
    loadMore,
    refetch,
  };
}
