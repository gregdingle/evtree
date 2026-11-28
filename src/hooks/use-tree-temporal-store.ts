import type { TemporalState } from "zundo";
import { useStoreWithEqualityFn } from "zustand/traditional";

import { TreeStoreState, useTreeStore } from "./use-tree-store";

export function useTreeTemporalStore(): TemporalState<TreeStoreState>;
export function useTreeTemporalStore<T>(
  selector: (state: TemporalState<Partial<TreeStoreState>>) => T,
): T;
export function useTreeTemporalStore<T>(
  selector: (state: TemporalState<Partial<TreeStoreState>>) => T,
  equality: (a: T, b: T) => boolean,
): T;
export function useTreeTemporalStore<T>(
  selector?: (state: TemporalState<Partial<TreeStoreState>>) => T,
  equality?: (a: T, b: T) => boolean,
) {
  return useStoreWithEqualityFn(useTreeStore.temporal, selector!, equality);
}
