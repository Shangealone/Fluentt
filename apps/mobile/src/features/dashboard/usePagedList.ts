import { useCallback, useState, useSyncExternalStore } from "react";
import { useFocusEffect } from "expo-router";
import { PagedList } from "./paging";

export function usePagedList<T extends { id: string }>(fetchPage: (offset: number) => Promise<T[]>) {
  const [list] = useState(() => new PagedList<T>());
  const state = useSyncExternalStore(list.subscribe, list.getSnapshot, list.getSnapshot);
  useFocusEffect(useCallback(() => {
    void list.load(fetchPage);
    return () => list.cancel();
  }, [fetchPage, list]));
  return { state, reload: () => void list.load(fetchPage),
    more: () => void list.load(fetchPage, state.rows.length) };
}
