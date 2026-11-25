import { mapValues } from "es-toolkit";

import {
  computeNodeValues,
  toComputeEdge,
  toComputeNode,
} from "@/lib/expectedValue";
import { getRootNodeIds } from "@/lib/maps";
import { DecisionTree } from "@/lib/tree";

import ageDefendant from "./age-discrimination-defendant-tree.json";
import agePlaintiff from "./age-discrimination-plaintiff-tree.json";
import componentSupply from "./component-supply-tree.json";
import defenseWithCosts from "./hapless-harvest-defense-with-costs-tree.json";
import plaintiffLessCosts from "./hapless-harvest-plaintiff-less-costs-tree.json";
import plaintiffNoCosts from "./hapless-harvest-plaintiff-no-costs-tree.json";
import patentInfringement from "./patent-infringement-tree.json";
import productLiability from "./product-liability-tree.json";

/**
 * The reference trees are transcribed from decision trees drawn by Marjorie
 * Corman Aaron. Each drawing shows the expected value of its root, which checks
 * the transcription of every probability and value.
 *
 * The description of each tree is the case text that it was drawn from: the
 * general information, and the information for counsel on that side.
 *
 * NOTE: two things are not as drawn, for the Issues page, see getIssues. The
 * question in the description of each node is ours, because the drawings have
 * none. The awards are labeled "High", "Mid" and "Low" on every path, where
 * the drawings have labels like "High No Contrib" and "High w Contrib" on some
 * paths, because the labels of an issue have to match for its nodes to be
 * grouped.
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
 *
 * The other reference trees are hypothetical cases with a known expected
 * value. The description of each tree states the facts and estimates of its
 * case in our own words.
 *
 * NOTE: about these trees:
 *
 * - The component supply and age discrimination trees do not start with a
 *   choice between litigating and settling, as the prompt asks of the AI. The
 *   patent infringement and product liability trees do, because their cases
 *   are about a settlement offer. The settlement is worth $1.8 million to the
 *   plaintiff in the first, and costs the defendant $500,000 in the second.
 *   Litigating is the better choice in both, so it gives the expected value.
 * - No tree has a branch for a certain outcome, as the prompt asks of the AI.
 * - Each age discrimination tree is one tree, with the damages after each path
 *   on which the defendant loses, and not a tree of the damages that starts
 *   from the overall chance that the defendant wins or loses.
 * - The age discrimination trees have probabilities of 2/3 and 1/3, not .67
 *   and .33. Those give $147,000 exactly for the defendant, and $30,333.33
 *   for the plaintiff, which comes to $30,000 when the probabilities of its
 *   outcomes are rounded to whole percents before they are added up.
 */
describe("reference trees", () => {
  test.each([
    ["Hapless Harvest plaintiff, no costs", plaintiffNoCosts, 9656.63, 22],
    ["Hapless Harvest plaintiff, less costs", plaintiffLessCosts, 7946.63, 22],
    ["Hapless Harvest defense, with costs", defenseWithCosts, -40000, 22],
    ["component supply", componentSupply, 3600000, 9],
    ["age discrimination defendant", ageDefendant, -147000, 46],
    ["age discrimination plaintiff", agePlaintiff, 30333.33, 34],
    ["patent infringement", patentInfringement, 2384000, 28],
    ["product liability", productLiability, -296800, 46],
  ])("should have the known expected value: %s", (_, data, ev, edges) => {
    const tree = data as unknown as DecisionTree;
    const { nodes } = computeNodeValues(
      mapValues(tree.nodes, (node) => toComputeNode(node)),
      mapValues(tree.edges, (edge) => toComputeEdge(edge)),
    );
    const rootIds = getRootNodeIds(tree.nodes, tree.edges);
    expect(rootIds).toHaveLength(1);
    expect(nodes[rootIds[0]!]!.data.value).toBeCloseTo(ev, 1);
    expect(Object.keys(tree.edges)).toHaveLength(edges);
  });
});
