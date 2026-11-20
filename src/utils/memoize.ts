/**
 * Memoize a function of one object argument. Results are cached in a WeakMap,
 * so they are garbage collected along with the argument.
 *
 * NOTE: es-toolkit memoize caches in a Map that is never cleared. Keyed on
 * store objects like trees or edges, it keeps every version ever created in
 * memory, including short-lived immer drafts.
 *
 * NOTE: the alternative is weakMapMemoize from reselect (or createSelector,
 * which uses it by default), worth adopting if we have many composed selectors.
 */
export function memoizeWeak<K extends object, V>(
  fn: (arg: K) => V,
): (arg: K) => V {
  const cache = new WeakMap<K, V>();
  return (arg) => {
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}
