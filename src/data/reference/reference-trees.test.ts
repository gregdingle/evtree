import { mapValues } from "es-toolkit";

import {
  computeNodeValues,
  toComputeEdge,
  toComputeNode,
} from "@/lib/expectedValue";
import { getRootNodeIds } from "@/lib/maps";
import { DecisionTree } from "@/lib/tree";

import defenseWithCosts from "./hapless-harvest-defense-with-costs-tree.json";
import plaintiffLessCosts from "./hapless-harvest-plaintiff-less-costs-tree.json";
import plaintiffNoCosts from "./hapless-harvest-plaintiff-no-costs-tree.json";

/**
 * The reference trees are transcribed from decision trees drawn by Marjorie
 * Corman Aaron. Each drawing shows the expected value of its root, which checks
 * the transcription of every probability and value.
 *
 * The description of each tree is the case text that it was drawn from: the
 * general information, and the information for counsel on that side.
 *
 * NOTE: The trees are a firm reference for structure, and a loose one for
 * numbers, because of these things in the source material:
 *
 * - The plaintiff trees disagree with the information for plaintiff's counsel.
 *   The text says that a finding of a knee injury only is "unlikely", but the
 *   trees give "Knee Only" a probability of 0.70 and 0.65.
 * - Some numbers in the trees are not in the case text. The 0.40 and 0.60 for
 *   contributory negligence, and the individual award amounts, are the author's
 *   own choices within the ranges that the text gives: $100,000 to $250,000 for
 *   both injuries, and $15,000 to $50,000 for the knee alone. The plaintiff tree
 *   that deducts costs uses $10,000, where the text estimates $3,000.
 * - In all three trees, the "Mid" award for both injuries is the same with 33%
 *   contributory negligence as without it, for example $150,000 in the
 *   plaintiff tree without costs. In the plaintiff tree that deducts costs,
 *   the "Mid" award for the knee alone is $10,000 without contributory
 *   negligence, where $20,000 would be expected. Those look like slips in the
 *   drawings. They are transcribed as drawn, because the expected values
 *   depend on them.
 */
describe("reference trees", () => {
  test.each([
    ["plaintiff, no costs", plaintiffNoCosts, 9656.63],
    ["plaintiff, less costs", plaintiffLessCosts, 7946.63],
    ["defense, with costs", defenseWithCosts, -40000],
  ])("should have the expected value of the drawing: %s", (_, data, ev) => {
    const tree = data as unknown as DecisionTree;
    const { nodes } = computeNodeValues(
      mapValues(tree.nodes, (node) => toComputeNode(node)),
      mapValues(tree.edges, (edge) => toComputeEdge(edge)),
    );
    const rootIds = getRootNodeIds(tree.nodes, tree.edges);
    expect(rootIds).toHaveLength(1);
    expect(nodes[rootIds[0]!]!.data.value).toBeCloseTo(ev, 1);
    expect(Object.keys(tree.edges)).toHaveLength(22);
  });
});
