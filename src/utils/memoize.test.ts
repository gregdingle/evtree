import { memoizeWeak } from "./memoize";

describe("memoizeWeak", () => {
  test("should cache by object identity", () => {
    const fn = jest.fn((obj: { n: number }) => ({ doubled: obj.n * 2 }));
    const memoized = memoizeWeak(fn);
    const arg = { n: 2 };

    const first = memoized(arg);
    expect(memoized(arg)).toBe(first);
    expect(fn).toHaveBeenCalledTimes(1);

    // An equal but different object is a cache miss
    expect(memoized({ n: 2 })).toEqual(first);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("should cache undefined results", () => {
    const fn = jest.fn(() => undefined);
    const memoized = memoizeWeak(fn);
    const arg = {};

    memoized(arg);
    memoized(arg);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
