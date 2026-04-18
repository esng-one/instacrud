// hooks/useReferenceField.ts

import {useCallback, useEffect, useState} from "react";

export interface ReferenceOption<T> {
  label: string;
  value: string | number;
  original: T;
}

export function useReferenceField<T>(
  fetchFn: () => Promise<T[]>,
  getValue: (item: T) => string | number,
  getLabel: (item: T) => string,
  refreshKey: number = 0,
  enabled: boolean = true,
) {
  const [options, setOptions] = useState<ReferenceOption<T>[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchFn();
        setOptions(
          data.map((item) => ({
            value: getValue(item),
            label: getLabel(item),
            original: item,
          }))
        );
      } catch (error) {
        if (!cancelled) console.error("Failed to load reference options", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [fetchFn, getValue, getLabel, refreshKey, internalRefreshKey, enabled]);

  const refetch = useCallback(() => {
    setInternalRefreshKey((k) => k + 1);
  }, []);

  return { options, loading, refetch };
}
