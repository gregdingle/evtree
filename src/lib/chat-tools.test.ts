/// <reference types="jest" />
import { values } from "es-toolkit/compat";

import { useTreeStore } from "@/hooks/use-tree-store";

import {
  SOURCE_AI,
  SOURCE_DESCRIPTION,
  convertAIStructureToDecisionTree,
  convertDecisionTreeToAIRows,
  getAIRowAliases,
} from "./ai-convert";
import { AINode } from "./ai-schemas";
import {
  ChatToolCall,
  applyChatToolCall,
  chatToolDeclarations,
  chatTools,
  checkChatToolCall,
} from "./chat-tools";
import { selectCurrentTree, selectUndoableState } from "./selectors";
import { DecisionTree } from "./tree";

jest.mock("nanoid", () => {
  let nextId = 0;
  return { nanoid: () => `id-${++nextId}` };
});

const sourceText = "The settlement releases all claims of the buyer.";

const row = (
  id: string,
  parentId: string | null,
  label: string | null,
  probability: number | null,
  fields: Partial<AINode> = {},
): AINode => ({
  id,
  parentId,
  label,
  quote: null,
  reason: label && `Because ${label.toLowerCase()}`,
  probability,
  question: null,
  value: null,
  cost: null,
  ...fields,
});

// NOTE: in the order that the branches are arranged in, so that the rows of
// the tree get the same ids
const nodes: AINode[] = [
  row("n1", null, null, null, { question: "Do the claims survive?" }),
  row("n2", "n1", "Survive", 0.75, { question: "How much is awarded?" }),
  row("n3", "n2", "High", 0.5, { value: 4000000 }),
  row("n4", "n2", "Low", 0.5, { value: 1000000 }),
  row("n5", "n1", "Barred", 0.25, { value: 0 }),
];

let aliases: Record<string, string>;

const getTree = () => selectCurrentTree(useTreeStore.getState())!;
const getContext = () => ({ tree: getTree(), aliases, sourceText });
const getRows = () => convertDecisionTreeToAIRows(getTree(), aliases);
const getRow = (id: string) => getRows().find((row) => row.id === id);
const undoable = () => selectUndoableState(useTreeStore.getState());
const check = (call: ChatToolCall) => checkChatToolCall(getContext(), call);
const apply = (call: ChatToolCall) => {
  const result = applyChatToolCall(useTreeStore.getState(), getContext(), call);
  // NOTE: new nodes get the next ids, as in a chat
  aliases = getAIRowAliases(getTree(), aliases);
  return result;
};

beforeEach(() => {
  const tree: DecisionTree = convertAIStructureToDecisionTree(
    {
      currency: "USD",
      summary: "Summary.",
      issues: [],
      nodes,
      openQuestions: [],
    },
    "Tree",
    { text: sourceText },
  );
  useTreeStore.getState().loadTree(tree, false);
  // NOTE: as after a tree is generated, see CreateDialog.tsx
  useTreeStore.getState().arrange();
  aliases = getAIRowAliases(getTree());
  useTreeStore.temporal.getState().clear();
});

const setProbabilities: ChatToolCall = {
  name: "set_probabilities",
  args: {
    nodeId: "n1",
    branches: [
      { id: "n2", probability: 0.6 },
      { id: "n5", probability: 0.4 },
    ],
    askFirst: false,
  },
};

const addBranch: ChatToolCall = {
  name: "add_branch",
  args: {
    parentId: "n2",
    label: "Mid",
    quote: "releases all claims",
    reason: "Because of the release.",
    probability: 0.2,
    value: 2500000,
    branches: [
      { id: "n3", probability: 0.4 },
      { id: "n4", probability: 0.4 },
    ],
    askFirst: false,
  },
};

const deleteBranch: ChatToolCall = {
  name: "delete_branch",
  args: {
    id: "n2",
    branches: [{ id: "n5", probability: 1 }],
    askFirst: false,
  },
};

describe("the registry of tools", () => {
  test("should say what each tool is for and what it calls", () => {
    const store = useTreeStore.getState();
    chatTools.forEach((tool) => {
      expect(tool.description).not.toBe("");
      expect(tool.useCase).not.toBe("");
      expect(tool.operations.length).toBeGreaterThan(0);
      tool.operations.forEach((operation) =>
        expect(typeof store[operation]).toBe("function"),
      );
    });
  });

  test("should declare every tool to the AI, with askFirst", () => {
    expect(chatToolDeclarations.map((tool) => tool.name)).toEqual([
      "set_probabilities",
      "set_branch_text",
      "set_node_fields",
      "add_branch",
      "delete_branch",
    ]);
    chatToolDeclarations.forEach(({ parameters }) => {
      expect(parameters).toMatchObject({ type: "object" });
      expect(parameters["required"]).toContain("askFirst");
      expect(parameters).not.toHaveProperty("$schema");
      // NOTE: the AI refuses a parameter that can be null, which zod writes
      // as a list of types or as anyOf
      expect(JSON.stringify(parameters)).not.toMatch(/"type":\[|anyOf|null/);
    });
  });
});

describe("checkChatToolCall", () => {
  test("should say what an edit would do, without doing it", () => {
    const before = undoable();
    expect(check(setProbabilities)).toEqual({
      askFirst: false,
      sentence:
        'Probabilities of "Do the claims survive?": Survive 75% → 60%, Barred 25% → 40%.',
      target: { nodeId: expect.any(String) },
    });
    expect(undoable()).toEqual(before);
  });

  test("should wait for the user when the AI says so", () => {
    expect(
      check({
        ...setProbabilities,
        args: { ...(setProbabilities.args as object), askFirst: true },
      }),
    ).toMatchObject({ askFirst: true });
  });

  test("should always wait for the user before deleting", () => {
    expect(check(deleteBranch)).toMatchObject({
      askFirst: true,
      sentence:
        'Delete the branch "Survive" of "Do the claims survive?", with the 2 nodes under it. Others: Barred 25% → 100%.',
    });
  });

  test.each<[string, ChatToolCall, string]>([
    ["an unknown tool", { name: "delete_tree", args: {} }, "no tool"],
    [
      "arguments of the wrong type",
      { name: "set_probabilities", args: { nodeId: 1, branches: "all" } },
      "expected string",
    ],
    [
      "a probability out of range",
      {
        name: "set_probabilities",
        args: {
          nodeId: "n1",
          branches: [
            { id: "n2", probability: 1.5 },
            { id: "n5", probability: -0.5 },
          ],
          askFirst: false,
        },
      },
      "<=1",
    ],
    [
      "an unknown row",
      {
        name: "set_probabilities",
        args: { nodeId: "n9", branches: [], askFirst: false },
      },
      "no row n9",
    ],
    [
      "probabilities that do not sum to 1",
      {
        name: "set_probabilities",
        args: {
          nodeId: "n1",
          branches: [
            { id: "n2", probability: 0.6 },
            { id: "n5", probability: 0.3 },
          ],
          askFirst: false,
        },
      },
      "sum to 0.9",
    ],
    [
      "a branch left out",
      {
        name: "set_probabilities",
        args: {
          nodeId: "n1",
          branches: [{ id: "n2", probability: 1 }],
          askFirst: false,
        },
      },
      "each of the branches: n2, n5",
    ],
    [
      "a branch of another node",
      {
        name: "set_probabilities",
        args: {
          nodeId: "n1",
          branches: [
            { id: "n2", probability: 0.5 },
            { id: "n3", probability: 0.5 },
          ],
          askFirst: false,
        },
      },
      "n3 is not a branch of n1",
    ],
    [
      "a value for a node with branches",
      {
        name: "set_node_fields",
        args: { id: "n2", value: 5, askFirst: false },
      },
      "only a terminal node has a value",
    ],
    [
      "a question for a terminal node",
      {
        name: "set_node_fields",
        args: { id: "n5", question: "Why?", askFirst: false },
      },
      "no question",
    ],
    [
      "text for the branch to the root",
      {
        name: "set_branch_text",
        args: { id: "n1", label: "Start", askFirst: false },
      },
      "root",
    ],
    [
      "a branch on a terminal node",
      {
        name: "add_branch",
        args: { ...(addBranch.args as object), parentId: "n5", branches: [] },
      },
      "terminal node",
    ],
    [
      "a new branch that takes the sum over 1",
      {
        name: "add_branch",
        args: { ...(addBranch.args as object), probability: 0.5 },
      },
      "sum to 1.3",
    ],
    [
      "deleting the root",
      { name: "delete_branch", args: { id: "n1", branches: [] } },
      "expected boolean",
    ],
    [
      "deleting the root, with askFirst",
      {
        name: "delete_branch",
        args: { id: "n1", branches: [], askFirst: true },
      },
      "root",
    ],
  ])("should refuse %s", (_, call, message) => {
    const before = undoable();
    const result = check(call);
    expect(result.error).toContain(message);
    expect(apply(call).error).toContain(message);
    expect(undoable()).toEqual(before);
  });

  test("should not overwrite an expression that uses a variable", () => {
    const tree = getTree();
    const edge = values(tree.edges).find((e) => e.data?.label === "Barred")!;
    useTreeStore.getState().updateEdgeData(edge.id, {
      probabilityExpr: "pBarred",
    });
    useTreeStore
      .getState()
      .updateNodeData(edge.target, { valueExpr: "claim * 0.5" });

    expect(check(setProbabilities).error).toContain('expression "pBarred"');
    expect(
      check({
        name: "set_node_fields",
        args: { id: "n5", value: 1, askFirst: false },
      }).error,
    ).toContain('expression "claim * 0.5"');
  });
});

describe("applyChatToolCall", () => {
  const { undo, redo } = useTreeStore.temporal.getState();
  const getPastCount = () => useTreeStore.temporal.getState().pastStates.length;

  /** Applies a call, and checks that undo takes it back and redo makes it again */
  const applyAndUndo = (call: ChatToolCall, steps = 1) => {
    const before = undoable();
    expect(apply(call).error).toBeUndefined();
    const after = undoable();
    expect(after).not.toEqual(before);
    expect(getPastCount()).toBe(steps);

    undo(steps);
    expect(undoable()).toEqual(before);
    redo(steps);
    expect(undoable()).toEqual(after);
  };

  test("should set the probabilities of a node as one undo step", () => {
    applyAndUndo(setProbabilities);
    expect(getRow("n2")).toMatchObject({ probability: 0.6 });
    expect(getRow("n5")).toMatchObject({ probability: 0.4 });
  });

  test("should leave a probability that stays the same as it is written", () => {
    const edge = values(getTree().edges).find(
      (e) => e.data?.label === "Barred",
    )!;
    useTreeStore.getState().updateEdgeData(edge.id, { probabilityExpr: "1/4" });
    apply({
      name: "set_probabilities",
      args: {
        nodeId: "n1",
        branches: [
          { id: "n2", probability: 0.75 },
          { id: "n5", probability: 0.25 },
        ],
        askFirst: false,
      },
    });
    expect(getTree().edges[edge.id]!.data!.probabilityExpr).toBe("1/4");
  });

  test("should set the text of a branch, with where its reason comes from", () => {
    applyAndUndo({
      name: "set_branch_text",
      args: {
        id: "n5",
        label: "Claims barred",
        quote: "releases all claims",
        reason: "The release is broad.",
        askFirst: false,
      },
    });
    const edge = values(getTree().edges).find(
      (e) => e.data?.label === "Claims barred",
    )!;
    expect(edge.data!.description).toBe(
      `The release is broad.\n\n${SOURCE_DESCRIPTION} "releases all claims"`,
    );
    expect(edge.data!.probabilityExpr).toBe("0.25");
  });

  test("should mark a reason without a quote as suggested by AI", () => {
    apply({
      name: "set_branch_text",
      args: {
        id: "n5",
        reason: "Under the parol evidence rule.",
        askFirst: false,
      },
    });
    expect(
      values(getTree().edges).find((e) => e.data?.label === "Barred")!.data!
        .description,
    ).toBe(`Under the parol evidence rule.\n\n${SOURCE_AI}`);
  });

  test("should set the fields of a node", () => {
    applyAndUndo({
      name: "set_node_fields",
      args: { id: "n3", value: 5000000, cost: 250000, askFirst: false },
    });
    expect(getRow("n3")).toMatchObject({ value: 5000000, cost: 250000 });
    expect(
      check({
        name: "set_node_fields",
        args: { id: "n3", value: 6000000, askFirst: false },
      }),
    ).toMatchObject({ sentence: 'Value of "High": $5M → $6M.' });
  });

  test("should add a branch, and arrange it as a second undo step", () => {
    expect(check(addBranch)).toMatchObject({
      sentence:
        'New branch "Mid" of "How much is awarded?", at 20%, with a value of $2.5M. Others: High 50% → 40%, Low 50% → 40%.',
    });
    // NOTE: two steps, the branch and then the arrange, as for the app's
    // own Add Branch, see `arrange` in chat-tools.ts
    applyAndUndo(addBranch, 2);
    expect(getRows().map((row) => [row.id, row.parentId])).toEqual([
      ["n1", null],
      ["n2", "n1"],
      ["n3", "n2"],
      ["n4", "n2"],
      ["n6", "n2"],
      ["n5", "n1"],
    ]);
    expect(getRow("n6")).toMatchObject({
      label: "Mid",
      quote: "releases all claims",
      reason: "Because of the release.",
      probability: 0.2,
      value: 2500000,
    });
    expect(getRow("n3")).toMatchObject({ probability: 0.4 });
    const types = values(getTree().nodes).map((node) => node.type);
    expect(types.filter((type) => type === "terminal")).toHaveLength(4);
  });

  test("should delete a branch with what is under it", () => {
    applyAndUndo(deleteBranch);
    expect(getRows().map((row) => row.id)).toEqual(["n1", "n5"]);
    expect(getRow("n5")).toMatchObject({ probability: 1 });
  });

  test("should make each of several calls in a row its own undo step", () => {
    const before = undoable();
    apply(setProbabilities);
    apply({
      name: "set_node_fields",
      args: { id: "n5", value: 100, askFirst: false },
    });
    apply({
      name: "set_node_fields",
      args: { id: "n3", value: 200, askFirst: false },
    });
    expect(getPastCount()).toBe(3);

    undo();
    expect(getRow("n3")).toMatchObject({ value: 4000000 });
    expect(getRow("n5")).toMatchObject({ value: 100 });
    undo(2);
    expect(undoable()).toEqual(before);
  });

  test("should refuse an edit that no longer fits the tree", () => {
    // The user is asked first, and deletes the branch by hand meanwhile
    const pending: ChatToolCall = {
      name: "set_node_fields",
      args: { id: "n3", value: 1, askFirst: true },
    };
    expect(check(pending).error).toBeUndefined();
    apply(deleteBranch);
    const before = undoable();

    expect(apply(pending).error).toContain("no row n3");
    expect(undoable()).toEqual(before);
  });
});
