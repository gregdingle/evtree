import bathtubTreeData from "@/data/demo-bathtub-tree.json";
import demoSexualTreeData from "@/data/demo-sexual-tree.json";
import { AppEdge } from "@/lib/edge";
import { AppNode } from "@/lib/node";
import { DecisionTree } from "@/lib/tree";
import { Position } from "@xyflow/react";
import { keyBy } from "es-toolkit";

const initialNodes = keyBy(
  [
    {
      id: "decision",
      type: "decision",
      data: {
        label: "decision",
        description: "decision description",
      },
      position: { x: 100, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "chance",
      type: "chance",
      data: {
        label: "chance",
        description: "chance description",
      },
      position: { x: 300, y: 0 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "terminal1",
      type: "terminal",
      data: {
        label: "terminal1",
        description: "terminal1 description",
        valueExpr: "500",
      },
      position: { x: 500, y: -75 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "terminal2",
      type: "terminal",
      data: {
        label: "terminal2",
        description: "terminal2 description",
        valueExpr: "1000",
      },
      position: { x: 500, y: 75 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
    {
      id: "terminal3",
      type: "terminal",
      data: {
        label: "terminal3",
        description: "terminal3 description",
        valueExpr: "250",
      },
      position: { x: 300, y: 150 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    },
  ] as AppNode[],
  (node) => node.id,
);

const initialEdges = keyBy(
  [
    {
      id: "decision-chance",
      source: "decision",
      target: "chance",
      type: "custom",
      data: {
        label: "d to c",
        description: "Connection from decision to chance",
        probability: null,
      },
    },
    {
      id: "chance-terminal1",
      source: "chance",
      target: "terminal1",
      type: "custom",
      data: {
        label: "c to t1",
        description: "Path from chance to terminal1",
        probability: 0.5,
      },
    },
    {
      id: "chance-terminal2",
      source: "chance",
      target: "terminal2",
      type: "custom",
      data: {
        label: "c to t2",
        description: "Path from chance to terminal2",
        probability: 0.5,
      },
    },
    {
      id: "decision-terminal3",
      source: "decision",
      target: "terminal3",
      type: "custom",
      data: {
        label: "d to t3",
        description: "Path from decision to terminal3",
        probability: null,
      },
    },
  ] as AppEdge[],
  (edge) => edge.id,
);

const initialTrees: Record<string, DecisionTree> = {
  "tree-1": {
    id: "tree-1",
    name: "Hello World Tree",
    description:
      "This is a demo tree that has all the various types of nodes arranged in a typical pattern",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: initialNodes,
    edges: initialEdges,
  },
  [demoSexualTreeData.id]: demoSexualTreeData as unknown as DecisionTree,
  [bathtubTreeData.id]: bathtubTreeData as unknown as DecisionTree,
};

export default initialTrees;
