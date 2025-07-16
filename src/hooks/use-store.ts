import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// TODO: adapt from zustand example
interface BearState {
  bears: number;
  increase: (by: number) => void;
}

const useStoreBase = create<BearState>()(
  persist(
    (set, get) => ({
      bears: 0,
      increase: (by) => set({ bears: get().bears + by }),
    }),
    {
      name: "evtree-storage", // name of the item in the storage (must be unique)
      // TODO: localStorage or sessionStorage?
      storage: createJSONStorage(() => window.localStorage),
    }
  )
);
// TODO: consider 3rd party libs like shared-zustand or simple-zustand-devtools
// from https://zustand.docs.pmnd.rs/integrations/third-party-libraries
// definitely zundo for undo/redo support!!!

//
// NOTE: Zustand example code. See https://zustand.docs.pmnd.rs/guides/auto-generating-selectors
//

import { StoreApi, UseBoundStore } from "zustand";

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (const k of Object.keys(store.getState())) {
    // NOTE: Zustand example code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export const useStore = createSelectors(useStoreBase);
