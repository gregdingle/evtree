import { sortBy } from "es-toolkit";
import { values } from "es-toolkit/compat";

import initialTrees from "./initialTrees";

describe("initialTrees", () => {
  test("should list the Hello World tree first", () => {
    // NOTE: the same order as the list of trees in LeftSidePanel
    const trees = sortBy(values(initialTrees), ["updatedAt"]).reverse();
    expect(trees).toHaveLength(4);
    expect(trees[0]!.name).toBe("Hello World Tree");
  });
});
