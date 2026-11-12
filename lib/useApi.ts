"use client";
import { useCallback, useEffect, useState } from "react";
export type Res<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void };
export function useApi<T>(fn: () => Promise<T>): Res<T> {
  const [s, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    set((p) => ({ ...p, loading: true, error: null }));
    fn().then((data) => live && set({ data, error: null, loading: false }), (e: Error) => live && set({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return { ...s, reload: useCallback(() => setN((x) => x + 1), []) };
}
