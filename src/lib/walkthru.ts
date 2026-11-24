import { isEqual } from "es-toolkit";
import { values } from "es-toolkit/compat";

import { AppEdge, filterTreeEdges } from "./edge";
import { toComputeNode } from "./expectedValue";
import { getNodeToIncomingEdgeMap, getRootNodeIds } from "./maps";
import { AppNode } from "./node";
import type { NetExpectedValues } from "./selectors";
import { DecisionTree } from "./tree";

/**
 * A walkthru explains a tree issue by issue, from a root. An issue is a node
 * that has branches. The same issue can occur on several paths, like a range
 * of awards under each finding of liability, so the nodes of an issue are
 * grouped into one section, with one occurrence for each node.
 *
 * NOTE: everything here comes from the tree and its computed values, so the
 * same tree always gives the same walkthru.
 */
export interface WalkthruRoot {
  rootId: string;
  expectedValue: number | null;
  sections: WalkthruSection[];
}

export interface WalkthruSection {
  key: string;
  /** The description of the node, or else its branch labels */
  heading: string;
  /** A decision takes its best option, where a chance weighs its outcomes */
  isDecision: boolean;
  outcomes: WalkthruSectionOutcome[];
  occurrences: WalkthruOccurrence[];
}

/** An outcome of an issue, summarized over the occurrences of the issue */
export interface WalkthruSectionOutcome {
  label: string;
  /** Null when missing, or when it differs between occurrences */
  probability: number | null;
  probabilityVaries: boolean;
  /** The distinct reasons given for this outcome */
  reasons: string[];
}

export interface WalkthruOccurrence {
  nodeId: string;
  /** The branch labels from the root to this node, empty for a root */
  path: string[];
  /** The cost that is incurred on reaching this node */
  cost: number | null;
  /** Net of the costs on the path to this node, and of its own cost */
  expectedValue: number | null;
  /**
   * The expected value from this node on: net of its own cost, but before the
   * costs on the path to it. See WalkthruOutcome.onwardValue.
   */
  onwardExpectedValue: number | null;
  outcomes: WalkthruOutcome[];
  /** False when a probability or a value is missing for the arithmetic */
  isComplete: boolean;
}

export interface WalkthruOutcome {
  edgeId: string;
  label: string;
  reason: string;
  probability: number | null;
  /** The value of what the outcome leads to, net of the costs on its path */
  value: number | null;
  /**
   * The value of what the outcome leads to, from there on. It is before the
   * cost of the node that the outcome is of, and before the costs on the path
   * to that node. For a terminal node, this is its value as entered.
   *
   * NOTE: there are two ways to write the same expected value of a node. With
   * net values, the costs are inside of every term:
   *
   *   net = Σ probability × value
   *
   * With onward values, the cost of the node is a term of its own, which is
   * how a tree is rolled back by hand:
   *
   *   onward = Σ probability × onwardValue − cost
   *
   * The two differ by the costs on the path to the node, so they are the same
   * at a root.
   */
  onwardValue: number | null;
  /** For a decision, whether this is an option with the best value */
  isBest: boolean;
}

/**
 * Returns a function that gives the branches of a node, from top to bottom as
 * on the canvas, like the layout.
 *
 * NOTE: arrow edges are not part of the tree
 */
function getChildEdgesGetter(tree: DecisionTree) {
  const childEdges: Record<string, AppEdge[]> = {};
  filterTreeEdges(values(tree.edges))
    .filter((edge) => tree.nodes[edge.target])
    .forEach((edge) => {
      (childEdges[edge.source] ??= []).push(edge);
    });
  values(childEdges).forEach((edges) =>
    edges.sort(
      (a, b) =>
        tree.nodes[a.target]!.position.y - tree.nodes[b.target]!.position.y,
    ),
  );
  return (nodeId: string) => childEdges[nodeId] ?? [];
}

/**
 * Returns a walkthru for each root node, because a canvas can hold more than
 * one tree
 */
export function getWalkthru(
  tree: DecisionTree,
  {
    nodeValues = {},
    nodeCumulativeCosts = {},
    edgeProbabilities = {},
  }: NetExpectedValues,
): WalkthruRoot[] {
  const getChildEdges = getChildEdgesGetter(tree);
  const getValue = (nodeId: string) => {
    const value = nodeValues[nodeId];
    return Number.isFinite(value) ? Number(value) : null;
  };
  // NOTE: adding back the costs on the path to a node, not counting its own
  const getOnwardValue = (nodeId: string) => {
    const value = getValue(nodeId);
    return value === null ? null : value + (nodeCumulativeCosts[nodeId] ?? 0);
  };

  return getRootNodeIds(tree.nodes, tree.edges).map((rootId) => {
    const sections: Record<string, WalkthruSection> = {};

    // NOTE: breadth first, so that sections are in order of the depth at which
    // an issue first occurs
    const queue: { nodeId: string; path: string[] }[] = [
      { nodeId: rootId, path: [] },
    ];
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { nodeId, path } = next;
      const node = tree.nodes[nodeId]!;
      const edges = getChildEdges(nodeId);
      if (edges.length === 0) {
        continue;
      }

      const isDecision = node.type === "decision";
      const outcomes = edges.map((edge, index): WalkthruOutcome => {
        const probability = edgeProbabilities[edge.id] ?? null;
        return {
          edgeId: edge.id,
          label: edge.data?.label?.trim() || `Outcome ${index + 1}`,
          reason: edge.data?.description?.trim() ?? "",
          probability,
          value: getValue(edge.target),
          onwardValue: getOnwardValue(edge.target),
          // NOTE: the options of a decision get a probability from their values
          isBest: isDecision && (probability ?? 0) > 0,
        };
      });

      const labels = outcomes.map((outcome) => outcome.label);
      const description = node.data.description?.trim() ?? "";
      // NOTE: the description is in the key so that different issues with the
      // same labels, like "Granted" and "Denied", stay apart. A tree made by
      // hand often has no descriptions, and labels the same issue differently
      // on different paths, like "High No Contrib" and "High w Contrib", so
      // then only the first word of each label has to match.
      const key = [
        description,
        ...(description ? labels : labels.map(getFirstWord)),
      ]
        .join("|")
        .toLowerCase();
      const section = (sections[key] ??= {
        key,
        heading: description,
        isDecision,
        outcomes: [],
        occurrences: [],
      });
      section.occurrences.push({
        nodeId,
        path,
        cost: toComputeNode(node, tree.variables).data.cost,
        expectedValue: getValue(nodeId),
        onwardExpectedValue: getOnwardValue(nodeId),
        outcomes,
        isComplete: outcomes.every(
          (outcome) =>
            outcome.value !== null &&
            // NOTE: the options of a decision have no probabilities of their own
            (outcome.probability !== null || isDecision),
        ),
      });

      edges.forEach((edge, index) => {
        queue.push({ nodeId: edge.target, path: [...path, labels[index]!] });
      });
    }

    values(sections).forEach((section) => {
      section.outcomes = section.occurrences[0]!.outcomes.map(
        (first, index): WalkthruSectionOutcome => {
          const all = section.occurrences.map(
            (occurrence) => occurrence.outcomes[index]!,
          );
          // NOTE: the part of the label that the occurrences have in common
          const label = all.every((outcome) => outcome.label === first.label)
            ? first.label
            : getFirstWord(first.label);
          const probabilityVaries = !all.every((outcome) =>
            isEqual(outcome.probability, first.probability),
          );
          return {
            label,
            probability: probabilityVaries ? null : first.probability,
            probabilityVaries,
            reasons: [
              ...new Set(all.map((outcome) => outcome.reason).filter(Boolean)),
            ],
          };
        },
      );
      section.heading ||= section.outcomes
        .map((outcome) => outcome.label)
        .join(" / ");
    });

    return {
      rootId,
      expectedValue: getValue(rootId),
      sections: values(sections),
    };
  });
}

function getFirstWord(label: string): string {
  return label.split(/\s+/)[0]!;
}

/** The nodes and edges of a SubTreeView, and the part of them to show */
export interface SubTreeElements {
  nodes: AppNode[];
  edges: AppEdge[];
  /** The branch that leads to the node, if it has one */
  incomingEdgeId?: string;
  /**
   * The box to crop to, in the coordinates of the nodes. The branch that leads
   * to the node, and the branches that go on from its outcomes, run out of the
   * box, so that they are cut off by its sides.
   *
   * NOTE: the same width for every node of a tree, see getSubTreeWidth, and the
   * node is at the same place in it. Only the height depends on the node.
   */
  bounds: { x: number; y: number; width: number; height: number };
}

/** The vertical distance between the branches of a node in a SubTreeView */
const BRANCH_SPACING = 80;

/**
 * The horizontal distance from a node to its outcomes, which is what the demo
 * trees have on the canvas
 */
const BRANCH_DISTANCE = 250;

/** The width of a chance or decision node, and a little more than a terminal */
const NODE_SIZE = 34;

/**
 * How far away the parent is put, and how much is shown of the branch from it,
 * so the parent is cut off.
 *
 * NOTE: the two go together. CustomEdge makes the label of a branch two
 * thirds as wide as the branch, and centers it 40 past the middle. For a
 * parent at 200 that is about 34 wide, the label starts no further left than
 * about 105 as measured in the browser, whatever its text, so 118 leaves a
 * margin. Check a label that fills its width before changing either.
 */
const PARENT_DISTANCE = 200;
const INCOMING_LENGTH = 118;

/**
 * How much is shown to the right of an outcome, which is room for the value
 * of a terminal node, which is as wide as its text. With rounding, the text is
 * no longer than about "-$999.9K". Without, it can be any length.
 * TODO: measure the value instead, because a long one without rounding is cut
 * off. React Flow could measure it, if the value were inside of the box of the
 * node in a static view.
 */
const ROUNDED_TERMINAL_LENGTH = 80;
const TERMINAL_LENGTH = 110;

/**
 * NOTE: far enough that the label of the branch, which is toward the middle,
 * is cut off as well
 */
const OUTGOING_DISTANCE = 1000;

const PADDING = 16;

/**
 * Returns the width of every SubTreeView of a tree, which is what the widest
 * one needs: a node with a branch that leads to it and a terminal node for an
 * outcome. The same width for all keeps the layout around them simple.
 */
function getSubTreeWidth(tree: Pick<DecisionTree, "rounding">): number {
  return (
    INCOMING_LENGTH +
    BRANCH_DISTANCE +
    NODE_SIZE +
    (tree.rounding ? ROUNDED_TERMINAL_LENGTH : TERMINAL_LENGTH)
  );
}

/**
 * Returns a node with its branches, for showing on their own, cropped to a
 * box. For context, the branch that leads to the node comes in from the left
 * side of the box, and a branch goes out to the right side from each outcome
 * that the tree continues from.
 *
 * NOTE: the nodes are not placed as on the canvas, but at standard distances.
 * On the canvas, the branches of an early issue are a whole subtree apart,
 * which would be mostly empty space here, and a branch can be any length,
 * which would give every view a width of its own.
 */
export function getSubTreeElements(
  tree: DecisionTree,
  nodeId: string,
): SubTreeElements {
  const node = tree.nodes[nodeId];
  if (!node) {
    return {
      nodes: [],
      edges: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    };
  }

  const getChildEdges = getChildEdgesGetter(tree);
  const getSize = (other: AppNode) => ({
    width: other.measured?.width ?? 0,
    height: other.measured?.height ?? 0,
  });
  const centerY = getSize(node).height / 2;
  // NOTE: positions are of the top left corner, so adjust for nodes of
  // different heights to keep the branches level
  const toSubTreeNode = (
    other: AppNode,
    offsetX: number,
    offsetY: number,
  ): AppNode => ({
    ...other,
    position: {
      x: offsetX,
      y: offsetY + centerY - getSize(other).height / 2,
    },
    selected: false,
    hidden: false,
    draggable: false,
  });
  // NOTE: these are out of the box, and only there because an edge needs a
  // node at each end. Transparent to be safe.
  const toOutsideNode = (
    other: AppNode,
    offsetX: number,
    offsetY: number,
  ): AppNode => ({
    ...toSubTreeNode(other, offsetX, offsetY),
    className: "opacity-0",
  });
  const toSubTreeEdge = (edge: AppEdge): AppEdge => ({
    ...edge,
    selected: false,
    hidden: false,
  });

  const nodes = [toSubTreeNode(node, 0, 0)];
  const edges: AppEdge[] = [];

  const incomingEdge =
    tree.edges[getNodeToIncomingEdgeMap(tree.edges)[nodeId]!];
  const parent = incomingEdge && tree.nodes[incomingEdge.source];
  if (incomingEdge && parent) {
    nodes.push(toOutsideNode(parent, -PARENT_DISTANCE, 0));
    edges.push(toSubTreeEdge(incomingEdge));
  }

  const childEdges = getChildEdges(nodeId);
  const height = Math.max(childEdges.length, 1) * BRANCH_SPACING;
  childEdges.forEach((edge, index) => {
    const offsetY = (index - (childEdges.length - 1) / 2) * BRANCH_SPACING;
    const child = toSubTreeNode(
      tree.nodes[edge.target]!,
      BRANCH_DISTANCE,
      offsetY,
    );
    nodes.push(child);
    edges.push(toSubTreeEdge(edge));

    // NOTE: one branch that goes straight on stands for all of the branches
    // from the outcome, because the box ends before they would part
    const [outgoingEdge] = getChildEdges(child.id);
    if (outgoingEdge) {
      nodes.push(
        toOutsideNode(
          tree.nodes[outgoingEdge.target]!,
          BRANCH_DISTANCE + OUTGOING_DISTANCE,
          offsetY,
        ),
      );
      edges.push(toSubTreeEdge(outgoingEdge));
    }
  });

  return {
    nodes,
    edges,
    incomingEdgeId: parent && incomingEdge?.id,
    bounds: {
      // NOTE: also for a root, which has no branch that leads to it, so that
      // the node is at the same place in every view
      x: -INCOMING_LENGTH,
      y: centerY - height / 2 - PADDING,
      width: getSubTreeWidth(tree),
      height: height + 2 * PADDING,
    },
  };
}
