import { values } from "es-toolkit/compat";

import { warnItemNotFound } from "@/utils/warn";

import { AppEdge, createEdge } from "./edge";
import { collectSubtreeNodeIds } from "./maps";
import { AppNode, NodeType, createNode } from "./node";
import { DecisionTree } from "./tree";

/**
 * Edits to a tree that more than one thing makes, as functions that change a
 * tree in place. They are for a draft of a tree inside of an update of the
 * tree store, see use-tree-store.ts, so that an edit of several parts is one
 * update, and one undo step.
 *
 * NOTE: both the operations of the tree store, which the app calls when a
 * user edits by hand, and the tools of the chat with AI, see chat-tools.ts,
 * build on these, so that the same edit is made the same way by both.
 */

export function clearSelections(tree: DecisionTree) {
  [...values(tree.nodes), ...values(tree.edges)]
    .filter((item) => item.selected)
    .forEach((item) => {
      item.selected = false;
    });
}

/**
 * Adds a node, and a branch to it from another node. Both are selected, and
 * nothing else is.
 */
export function addChildNodeHelper(
  tree: DecisionTree,
  position: { x: number; y: number },
  fromNodeId: string,
  nodeType: NodeType = "chance",
): { node: AppNode; edge: AppEdge } {
  clearSelections(tree);
  const node = createNode(position, nodeType);
  const edge = createEdge(fromNodeId, node.id);
  tree.nodes[node.id] = node;
  tree.edges[edge.id] = edge;
  return { node, edge };
}

/** Deletes a node with everything under it, and the branch that leads to it */
export function deleteSubTreeHelper(tree: DecisionTree, nodeId: string) {
  const rootNode = tree.nodes[nodeId];
  if (!rootNode) {
    warnItemNotFound("Node", nodeId, "delete subtree");
    return;
  }

  const nodeIdsToDelete = collectSubtreeNodeIds(tree, nodeId);

  // Delete all edges that have source or target in the subtree
  values(tree.edges).forEach((edge) => {
    if (nodeIdsToDelete.has(edge.source) || nodeIdsToDelete.has(edge.target)) {
      delete tree.edges[edge.id];
    }
  });

  // Delete all nodes in the subtree
  nodeIdsToDelete.forEach((nodeId) => {
    delete tree.nodes[nodeId];
  });
}
