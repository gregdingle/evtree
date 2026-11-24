import { groupBy, sumBy } from "es-toolkit";

import { AINode, AITree } from "./ai-schemas";
import { AppEdge, createEdge } from "./edge";
import { AppNode, createNode } from "./node";
import { DecisionTree, createTree } from "./tree";

// NOTE: this is apart from ai.ts so that it can be tested without Firebase

type AIChildren = Record<string, AINode[]>;

/**
 * Returns the expected size of the amounts that a node leads to, ignoring
 * their sign and any costs.
 */
function getExpectedSize(aiNode: AINode, children: AIChildren): number {
  const childNodes = children[aiNode.id];
  if (!childNodes) {
    return Math.abs(aiNode.value ?? 0);
  }
  return sumBy(
    childNodes,
    (child) => (child.probability ?? 0) * getExpectedSize(child, children),
  );
}

/**
 * Returns the place of each node among the branches of its parent, from the
 * top, with the branch that leads to the largest amounts first.
 *
 * NOTE: Why order the branches at all? The human-crafted trees that we use for
 * reference follow a convention: the case of the plaintiff runs along the top.
 * At each issue, the outcome that keeps the claim alive comes first, the
 * outcome that ends the case for the defendant comes last, and awards go from
 * high to low. That holds whichever side the tree is written for. In a tree
 * for the defendant, the top path is still the plaintiff winning, with the
 * largest payment at the top.
 *
 * The AI does not follow the convention by itself. Of three trees that it
 * generated from the descriptions of reference trees, one came out in the
 * order of its reference tree, one fully reversed, with the defense verdict
 * and the lowest award first, and one mixed.
 *
 * Ordering by size, ignoring sign, gives the convention without knowing which
 * side the tree is for: a branch that continues to an award comes before one
 * that ends at nothing, and a higher award before a lower one. All 60 chance
 * nodes of the Hapless Harvest, component supply, patent infringement and
 * product liability reference trees are in this order, and 26 of the 33 chance
 * nodes of the three generated trees were.
 *
 * Where the rule falls short:
 * - Branches of the same size stay in the order of the AI, such as two ways to
 *   the same award.
 * - A branch that ends in a loss for the party of the tree, such as its fees
 *   when it loses, counts by the size of the loss. It comes first if that is
 *   more than the other branches are expected to win.
 * - Not every human-crafted tree agrees. The age discrimination reference
 *   trees are as their source drew them, with single damages before double,
 *   the lower fees before the higher, and a ruling for the defendant before
 *   one for the plaintiff. The reference trees are not held to this order.
 *
 * The alternative is to ask for the order in step 1 of prompt.md, for example
 * "list the outcome that keeps the claim of the plaintiff alive first, and
 * awards from high to low". That states the convention itself, where the size
 * is only a stand-in for it, and it could order branches of the same size. But
 * it adds to the prompt, cannot be tested, and the AI already applies the
 * rules of the prompt about its nodes unevenly. It could be tried on top of
 * this, since the order of the AI is kept between branches of the same size.
 */
function getBranchPlaces(children: AIChildren): Record<string, number> {
  const places: Record<string, number> = {};
  Object.values(children).forEach((childNodes) => {
    const sizes = new Map(
      childNodes.map((child) => [child, getExpectedSize(child, children)]),
    );
    // NOTE: the sort is stable, so that the order of the AI is kept between
    // branches of the same size
    [...childNodes]
      .sort((a, b) => sizes.get(b)! - sizes.get(a)!)
      .forEach((child, place) => {
        places[child.id] = place;
      });
  });
  return places;
}

/**
 * Converts the AI-generated flat list of nodes to DecisionTree format. Each
 * AI node becomes a node, and an edge from its parent if it has one.
 * The tree takes the currency that the AI inferred, and rounding to match.
 */
export function convertAIStructureToDecisionTree(
  aiTree: AITree,
  name: string,
  description: string,
): DecisionTree {
  const children: AIChildren = groupBy(
    aiTree.nodes.filter((aiNode) => aiNode.parentId !== null),
    (aiNode) => aiNode.parentId!,
  );
  const branchPlaces = getBranchPlaces(children);

  // NOTE: nodes get new ids, so keep a map from the ids that the AI gave them
  const nodeIds: Record<string, string> = {};
  const nodes: Record<string, AppNode> = {};
  aiTree.nodes.forEach((aiNode) => {
    // Determine node type based on whether it has child nodes
    // TODO: consider adding decision nodes to the prompt and AI schemas, for
    // choices that a party makes itself, such as filing a motion. The prompt
    // currently only asks for chance and terminal nodes.
    // TODO: we shouldn't really define decision nodes this way... either
    // exclude decision node, or else modify the prompt and AI schemas to return
    // decision nodes
    const childCount = children[aiNode.id]?.length ?? 0;
    let nodeType: "decision" | "chance" | "terminal";
    if (childCount === 0) {
      nodeType = "terminal";
    } else if (childCount === 1) {
      nodeType = "decision";
    } else {
      nodeType = "chance";
    }

    // NOTE: positions are replaced by the auto-arrange after, which keeps the
    // branches of a node in the order of their vertical positions, see
    // getLayoutedElementsD3. So the vertical position is only the place of the
    // node among the branches of its parent.
    const position = { x: 0, y: branchPlaces[aiNode.id] ?? 0 };
    const appNode = createNode(position, nodeType, false, {
      // NOTE: the description of a node is the question that it decides
      description: aiNode.question ?? "",
      // NOTE: convert to string which will be converted back to number internally
      // TODO: when the description mentions an amount but doesn't give it, have
      // the AI infer a named variable instead of guessing a number or leaving it
      // null, both for outcome values and for costs. Variables should come only
      // from mentions in the text, like "trial fees" or "lost profits": no
      // mention, no variable needed. For example "lostProfits * 0.5" or
      // "trialFees", with the variables added to the tree's variables so the
      // user can fill them in. Needs the AI schema, prompt and this
      // conversion to support expressions.
      valueExpr: aiNode.value?.toString() || undefined,
      costExpr: aiNode.cost?.toString() || undefined,
    });
    nodes[appNode.id] = appNode;
    nodeIds[aiNode.id] = appNode.id;
  });

  // NOTE: edges are created after all the nodes, so that the order of the AI
  // nodes doesn't matter
  const edges: Record<string, AppEdge> = {};
  aiTree.nodes.forEach((aiNode) => {
    if (aiNode.parentId === null) {
      return;
    }
    const edge = createEdge(
      nodeIds[aiNode.parentId]!,
      nodeIds[aiNode.id]!,
      false,
      {
        label: aiNode.label || "",
        // NOTE: convert to string which will be converted back to number internally
        probabilityExpr: aiNode.probability?.toString() || undefined,
        description: aiNode.reason || "",
      },
    );
    edges[edge.id] = edge;
  });

  return {
    ...createTree(name, description, nodes, edges),
    currency: aiTree.currency ?? undefined,
    // NOTE: rounding is a convention of the country more than of the case, so
    // it follows from the currency: "bn" for pounds, and "B" otherwise
    rounding: aiTree.currency === "GBP" ? "UK" : "US",
  };
}
