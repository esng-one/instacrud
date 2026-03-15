// hooks/usePaginatedEntityList.ts
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

interface UsePaginatedEntityListOptions<T> {
  fetchPage: (skip: number, limit: number) => Promise<T[]>;
  initialPageSize?: number;
  enabled?: boolean;
}

export function usePaginatedEntityList<T>({
  fetchPage,
  initialPageSize = 50,
  enabled = true,
}: UsePaginatedEntityListOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(enabled);

  const fetchData = async (page: number, pageSize: number) => {
    setLoading(true);
    try {
      const result = await fetchPage(page * pageSize, pageSize + 1);
      const hasMore = result.length > pageSize;
      const currentItems = result.slice(0, pageSize);

      if (page > 0 && currentItems.length === 0) {
        setPage((prev) => Math.max(prev - 1, 0));
        return;
      }

      setItems(currentItems);
      setTotalCount(hasMore ? (page + 1) * pageSize + 1 : page * pageSize + result.length);
    } catch (error) {
      toast.error("Error fetching data");
      console.error("Pagination fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      fetchData(page, pageSize);
    } else {
      setLoading(false);
    }
  }, [page, pageSize, enabled]);

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  return {
    items,
    page,
    pageSize,
    totalCount,
    loading,
    setPage,
    setPageSize,
    handlePageChange,
    refetch: () => fetchData(page, pageSize),
  };
}