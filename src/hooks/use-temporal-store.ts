import type { TemporalState } from "zundo";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { StoreState, useStore } from "./use-store";

export function useTemporalStore(): TemporalState<StoreState>;
export function useTemporalStore<T>(
  selector: (state: TemporalState<StoreState>) => T,
): T;
export function useTemporalStore<T>(
  selector: (state: TemporalState<StoreState>) => T,
  equality: (a: T, b: T) => boolean,
): T;
export function useTemporalStore<T>(
  selector?: (state: TemporalState<StoreState>) => T,
  equality?: (a: T, b: T) => boolean,
) {
  return useStoreWithEqualityFn(useStore.temporal, selector!, equality);
}
