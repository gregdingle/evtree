/// <reference types="jest" />
import type { Content, FunctionCall } from "firebase/ai";

import { ChatEdit, useChatStore } from "@/hooks/use-chat-store";
import { useTreeStore } from "@/hooks/use-tree-store";

import {
  ChatModel,
  MAX_TOOL_ROUNDS,
  acceptChatEdit,
  buildChatContents,
  buildChatSystemInstruction,
  getChatIntro,
  rejectChatEdit,
  sendChatMessage,
} from "./ai-chat";
import {
  convertAIStructureToDecisionTree,
  convertDecisionTreeToAIRows,
} from "./ai-convert";
import { AINode } from "./ai-schemas";
import { selectCurrentTree, selectUndoableState } from "./selectors";

// TODO: a set of conversations to run against the AI itself, which these
// tests do not call: one for each line of "When to edit" in chat-prompt.md,
// and for each way of working, on the reference trees, several times each.
// Score whether the calls are sound, stay with what was asked, and ask first
// when they should. It needs a way to call the AI outside of a browser with
// App Check.

jest.mock("nanoid", () => {
  let nextId = 0;
  return { nanoid: () => `id-${++nextId}` };
});

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

const nodes: AINode[] = [
  row("n1", null, null, null, { question: "Is the motion granted?" }),
  row("n2", "n1", "Denied", 0.7, { question: "How much is awarded?" }),
  row("n3", "n2", "High", 0.5, { value: 4000000 }),
  row("n4", "n2", "Low", 0.5, { value: 1000000 }),
  row("n5", "n1", "Granted", 0.3, { value: 0 }),
];

interface Round {
  text?: string[];
  calls?: Pick<FunctionCall, "name" | "args">[];
  fail?: string;
}

/** A model that plays back rounds, and records what it was sent */
function fakeModel(rounds: Round[]) {
  const requests: Content[][] = [];
  const model = {
    generateContentStream: async (request: { contents: Content[] }) => {
      requests.push(JSON.parse(JSON.stringify(request.contents)));
      const round = rounds[requests.length - 1] ?? {};
      if (round.fail) {
        throw new Error(round.fail);
      }
      const calls = (round.calls ?? []).map((call, index) => ({
        ...call,
        id: `call-${requests.length}-${index}`,
      }));
      return {
        stream: (async function* () {
          for (const text of round.text ?? []) {
            yield { text: () => text };
          }
        })(),
        response: Promise.resolve({
          functionCalls: () => (calls.length ? calls : undefined),
          candidates: [
            {
              content: {
                role: "model",
                parts: calls.map((functionCall) => ({
                  type: "functionCall",
                  functionCall,
                  thoughtSignature: "signature",
                })),
              },
            },
          ],
        }),
      };
    },
  } as unknown as ChatModel;
  return { model, requests };
}

let treeId: string;
const getTree = () => selectCurrentTree(useTreeStore.getState())!;
const getChat = () => useChatStore.getState().chats[treeId]!;
const getRows = () => convertDecisionTreeToAIRows(getTree(), getChat().aliases);
const getProbabilities = () =>
  Object.fromEntries(getRows().map((row) => [row.id, row.probability]));
const getReply = () => getChat().messages.at(-1)!;
const getText = (content: Content | undefined) =>
  content?.parts.map((part) => ("text" in part ? part.text : "")).join("");
const send = (rounds: Round[], text = "Hello", signal?: AbortSignal) => {
  const { model, requests } = fakeModel(rounds);
  const texts: string[] = [];
  const edits: ChatEdit[] = [];
  return sendChatMessage({
    treeId,
    text,
    model,
    signal,
    onText: (text) => texts.push(text),
    onEdit: (edit) => edits.push(edit),
  }).then(() => ({ requests, texts, edits }));
};

const setProbabilities = (askFirst: boolean, granted = 0.4) => ({
  name: "set_probabilities",
  args: {
    nodeId: "n1",
    branches: [
      { id: "n2", probability: 1 - granted },
      { id: "n5", probability: granted },
    ],
    askFirst,
  },
});

beforeEach(() => {
  useChatStore.setState({ chats: {} });
  const tree = convertAIStructureToDecisionTree(
    { currency: "USD", summary: "Summary.", issues: [], nodes },
    "Tree",
  );
  treeId = useTreeStore.getState().loadTree(tree, false);
  useTreeStore.getState().arrange();
  useTreeStore.temporal.getState().clear();
});

describe("buildChatSystemInstruction", () => {
  test("should put the prompts first and the case description last", () => {
    const instruction = buildChatSystemInstruction("CHAT", "METHOD", {
      issues: ["Is the motion granted? Yes or no"],
      source: { text: "The buyer sued." },
    });
    const places = [
      "CHAT",
      "<method>\nMETHOD\n</method>",
      "<issues>\n1. Is the motion granted? Yes or no\n</issues>",
      "<case_description>\nThe buyer sued.\n</case_description>",
    ].map((part) => instruction.indexOf(part));
    expect(places).toEqual([...places].sort((a, b) => a - b));
    expect(places[0]).toBe(0);
  });

  test("should say so when there is no case description", () => {
    const instruction = buildChatSystemInstruction("CHAT", "METHOD", undefined);
    expect(instruction).toContain("There is no case description");
    expect(instruction).not.toContain("<issues>");
  });
});

describe("getChatIntro", () => {
  test("should count where the reasons of a tree come from", () => {
    const source = { text: "The motion is likely to be denied." };
    const tree = convertAIStructureToDecisionTree(
      {
        currency: null,
        summary: "",
        issues: [],
        nodes: nodes.map((node) => ({
          ...node,
          value: node.value === null ? null : node.value / 4000000,
          quote:
            node.id === "n2"
              ? "likely to be denied"
              : node.id === "n3"
                ? "a high award"
                : null,
        })),
      },
      "Tree",
      source,
    );
    expect(getChatIntro(tree)).toEqual({
      nodes: 5,
      quoted: 1,
      suggested: 2,
      notFound: 1,
      hasPlaceholderAmounts: true,
    });
    expect(getChatIntro(getTree())).toEqual({
      nodes: 5,
      quoted: 0,
      suggested: 0,
      notFound: 0,
      hasPlaceholderAmounts: false,
    });
  });
});

describe("buildChatContents", () => {
  const edit = (status: ChatEdit["status"]): ChatEdit => ({
    id: status,
    call: { name: "set_probabilities", args: {} },
    sentence: `Probabilities ${status}.`,
    status,
  });

  test("should give the tree with the latest message only", async () => {
    await send([{ text: ["First reply."] }], "First");
    const { requests } = await send([{ text: ["Second reply."] }], "Second");
    const contents = requests[0]!;

    expect(contents.map((content) => content.role)).toEqual([
      "user",
      "model",
      "user",
    ]);
    expect(getText(contents[0])).toBe("First");
    expect(getText(contents[1])).toBe("First reply.");
    expect(getText(contents[2])).toMatch(
      /^<tree_description>\nTree\n\nSummary\.\n<\/tree_description>\n\n<tree>\n\[\{"id":"n1"/,
    );
    expect(getText(contents[2])).toMatch(/<\/tree>\n\nSecond$/);
    // The ids of the nodes themselves are not sent
    expect(getText(contents[2])).not.toContain(Object.keys(getTree().nodes)[0]);
  });

  test("should say what became of the edits of a reply, with the next message", () => {
    const contents = buildChatContents(
      [
        { id: "1", role: "user", text: "First", createdAt: "" },
        {
          id: "2",
          role: "ai",
          text: "",
          edits: [edit("done"), edit("rejected"), edit("waiting")],
          createdAt: "",
        },
        { id: "3", role: "user", text: "Second", createdAt: "" },
      ],
      getTree(),
      {},
    );
    expect(getText(contents[1])).toBe("(No text.)");
    expect(getText(contents[2])).toContain(
      "<earlier_edits>\n- Made: Probabilities done.\n- Rejected by the user, and not made: Probabilities rejected.\n- Waiting for the user to accept or reject: Probabilities waiting.\n</earlier_edits>",
    );
  });

  test("should start with a message of the user", () => {
    const contents = buildChatContents(
      [
        { id: "1", role: "ai", text: "Reply", createdAt: "" },
        { id: "2", role: "user", text: "Question", createdAt: "" },
      ],
      getTree(),
      {},
    );
    expect(contents.map((content) => content.role)).toEqual(["user"]);
  });

  test("should say what is selected, and where else its issue is decided", async () => {
    const tree = getTree();
    const high = Object.values(tree.edges).find(
      (edge) => edge.data?.label === "High",
    )!;
    useTreeStore.getState().selectEdge(high.id);
    const { requests } = await send([{ text: ["Reply."] }]);
    expect(getText(requests[0]![0])).toContain(
      '<selection>\nThe branch "High" (row n3) of "How much is awarded?" (row n2). It is reached by: Denied › High.\n</selection>',
    );

    useTreeStore.getState().selectNode(high.source);
    useTreeStore
      .getState()
      .updateNodeData(
        Object.values(getTree().nodes).find(
          (node) => node.data.description === "Is the motion granted?",
        )!.id,
        { description: "How much is awarded?" },
      );
    const second = await send([{ text: ["Reply."] }]);
    expect(getText(second.requests[0]!.at(-1))).toContain(
      'The node "How much is awarded?" (row n2). It is reached by: Denied. The same issue is also decided at row n1.',
    );
  });
});

describe("sendChatMessage", () => {
  test("should add the message and a reply of text", async () => {
    const before = selectUndoableState(useTreeStore.getState());
    const { texts, edits } = await send(
      [{ text: ["Because ", "of the standard."] }],
      "Why 30%?",
    );
    expect(getChat().messages).toMatchObject([
      { role: "user", text: "Why 30%?" },
      { role: "ai", text: "Because of the standard." },
    ]);
    expect(getReply().edits).toBeUndefined();
    expect(texts).toEqual(["Because ", "Because of the standard."]);
    expect(edits).toEqual([]);
    expect(selectUndoableState(useTreeStore.getState())).toEqual(before);
  });

  test("should make an edit that the user asked for, and tell the AI", async () => {
    const { requests, edits } = await send(
      [{ calls: [setProbabilities(false)] }, { text: ["As you say."] }],
      "Set granted to 40%.",
    );
    expect(getProbabilities()).toMatchObject({ n2: 0.6, n5: 0.4 });
    expect(getReply()).toMatchObject({
      text: "As you say.",
      edits: [
        {
          status: "done",
          sentence:
            'Probabilities of "Is the motion granted?": Denied 70% → 60%, Granted 30% → 40%.',
          note: "Expected value $1.8M → $1.5M",
        },
      ],
    });
    expect(edits).toHaveLength(1);

    // The second request has the call as it came, and its result
    const [call, result] = requests[1]!.slice(-2);
    expect(call).toMatchObject({
      role: "model",
      parts: [{ thoughtSignature: "signature" }],
    });
    expect(result).toEqual({
      role: "user",
      parts: [
        {
          type: "functionResponse",
          functionResponse: {
            name: "set_probabilities",
            id: "call-1-0",
            response: { result: "Made. Expected value $1.8M → $1.5M" },
          },
        },
      ],
    });

    // One undo step
    useTreeStore.temporal.getState().undo();
    expect(getProbabilities()).toMatchObject({ n2: 0.7, n5: 0.3 });
  });

  test("should hold an edit that the user did not ask for", async () => {
    const { requests } = await send(
      [{ calls: [setProbabilities(true)] }, { text: ["The other side says…"] }],
      "Argue the other side.",
    );
    expect(getProbabilities()).toMatchObject({ n2: 0.7, n5: 0.3 });
    expect(getReply().edits).toMatchObject([{ status: "waiting" }]);
    expect(getReply().edits![0]!.note).toBeUndefined();
    expect(JSON.stringify(requests[1]!.at(-1))).toContain("Not made yet");
  });

  test("should hold an edit of a tool that always asks", async () => {
    await send([
      {
        calls: [
          {
            name: "delete_branch",
            args: {
              id: "n4",
              branches: [{ id: "n3", probability: 1 }],
              askFirst: false,
            },
          },
        ],
      },
    ]);
    expect(getRows()).toHaveLength(5);
    expect(getReply().edits).toMatchObject([{ status: "waiting" }]);
  });

  test("should tell the AI what is wrong with a call, for it to correct", async () => {
    const { requests } = await send([
      { calls: [setProbabilities(false, 1.4)] },
      { calls: [setProbabilities(false, 0.4)] },
      { text: ["Done."] },
    ]);
    expect(JSON.stringify(requests[1]!.at(-1))).toContain('"error"');
    expect(getProbabilities()).toMatchObject({ n2: 0.6, n5: 0.4 });
    // Only the call that was sound is in the chat
    expect(getReply().edits).toHaveLength(1);
  });

  test("should give a new node a short id for the next call", async () => {
    await send([
      {
        calls: [
          {
            name: "add_branch",
            args: {
              parentId: "n2",
              label: "Mid",
              reason: "A compromise verdict.",
              probability: 0.2,
              value: 2000000,
              branches: [
                { id: "n3", probability: 0.4 },
                { id: "n4", probability: 0.4 },
              ],
              askFirst: false,
            },
          },
        ],
      },
      {
        calls: [
          {
            name: "set_node_fields",
            args: { id: "n6", value: 2500000, askFirst: false },
          },
        ],
      },
    ]);
    expect(getRows().find((row) => row.id === "n6")).toMatchObject({
      label: "Mid",
      value: 2500000,
      // NOTE: without a case description, a reason has no footnote
      reason: "A compromise verdict.",
    });
    expect(getReply().edits).toMatchObject([
      { status: "done" },
      { status: "done", sentence: 'Value of "Mid": $2M → $2.5M.' },
    ]);
  });

  test("should stop after the limit of rounds of calls", async () => {
    const rounds = Array.from({ length: 10 }, (_, index) => ({
      calls: [setProbabilities(false, 0.1 + index / 100)],
    }));
    const { requests } = await send(rounds);
    expect(requests).toHaveLength(MAX_TOOL_ROUNDS + 1);
    expect(getReply().edits).toHaveLength(MAX_TOOL_ROUNDS);
  });

  test("should keep the edits that were made when the AI then fails", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    await send([{ calls: [setProbabilities(false)] }, { fail: "503" }]);
    expect(getProbabilities()).toMatchObject({ n5: 0.4 });
    expect(getReply()).toMatchObject({
      role: "ai",
      text: "",
      error: "503",
      edits: [{ status: "done" }],
    });
    error.mockRestore();
  });

  test("should add a reply without an error when the user stops it", async () => {
    const controller = new AbortController();
    controller.abort();
    await send([{ fail: "AbortError" }], "Hello", controller.signal);
    expect(getReply()).toMatchObject({ role: "ai", text: "" });
    expect(getReply().error).toBeUndefined();
  });

  test("should do nothing for a tree that is not open", async () => {
    const other = useTreeStore.getState().createTree("Other");
    expect(useTreeStore.getState().currentTreeId).toBe(other);
    await send([{ text: ["Reply."] }]);
    expect(useChatStore.getState().chats[treeId]).toBeUndefined();
  });
});

describe("accepting and rejecting an edit", () => {
  const hold = async () => {
    await send([{ calls: [setProbabilities(true)] }]);
    return getReply().edits![0]!;
  };

  test("should make an accepted edit as the AI wrote it", async () => {
    acceptChatEdit(treeId, await hold());
    expect(getProbabilities()).toMatchObject({ n2: 0.6, n5: 0.4 });
    expect(getReply().edits![0]).toMatchObject({
      status: "accepted",
      note: "Expected value $1.8M → $1.5M",
    });
  });

  test("should not make a rejected edit", async () => {
    rejectChatEdit(treeId, await hold());
    expect(getProbabilities()).toMatchObject({ n2: 0.7, n5: 0.3 });
    expect(getReply().edits![0]).toMatchObject({ status: "rejected" });
  });

  test("should say why an accepted edit no longer fits the tree", async () => {
    const edit = await hold();
    const granted = Object.values(getTree().edges).find(
      (edge) => edge.data?.label === "Granted",
    )!;
    useTreeStore.getState().deleteSubTree(granted.target);

    acceptChatEdit(treeId, edit);
    expect(getProbabilities()).toMatchObject({ n2: 0.7 });
    expect(getReply().edits![0]).toMatchObject({
      status: "failed",
      note: expect.stringContaining("n5 is not a branch of n1"),
    });
  });

  test("should tell the AI what the user chose, with the next message", async () => {
    rejectChatEdit(treeId, await hold());
    const { requests } = await send([{ text: ["Understood."] }], "No.");
    expect(getText(requests[0]!.at(-1))).toContain(
      "- Rejected by the user, and not made: Probabilities of",
    );
  });
});
