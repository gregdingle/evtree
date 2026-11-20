import { countBy } from "es-toolkit";

import { AITree } from "./ai-schemas";
import { AppEdge, createEdge } from "./edge";
import { AppNode, createNode } from "./node";
import { DecisionTree, createTree } from "./tree";

// NOTE: this is apart from ai.ts so that it can be tested without Firebase

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
  // NOTE: ignore positions because auto-arrange after
  const dummyPosition = { x: 0, y: 0 };

  const childCounts = countBy(
    aiTree.nodes.filter((aiNode) => aiNode.parentId !== null),
    (aiNode) => aiNode.parentId!,
  );

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
    const childCount = childCounts[aiNode.id] ?? 0;
    let nodeType: "decision" | "chance" | "terminal";
    if (childCount === 0) {
      nodeType = "terminal";
    } else if (childCount === 1) {
      nodeType = "decision";
    } else {
      nodeType = "chance";
    }

    const appNode = createNode(dummyPosition, nodeType, false, {
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
