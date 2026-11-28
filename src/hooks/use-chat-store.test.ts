/// <reference types="jest" />
import {
  MAX_CHAT_MESSAGES,
  MAX_SOURCE_LENGTH,
  selectChat,
  useChatStore,
} from "./use-chat-store";
import { useTreeStore } from "./use-tree-store";

let nextId = 0;
jest.mock("nanoid", () => ({ nanoid: () => `id-${++nextId}` }));

const { addMessage, updateEdit, setSource, setIssues, setAliases } =
  useChatStore.getState();
const getChat = (treeId = "tree") =>
  selectChat(useChatStore.getState(), treeId);

beforeEach(() => {
  useChatStore.setState({ chats: {} });
});

describe("the chat store", () => {
  test("should keep the messages of each tree apart", () => {
    addMessage("tree", { role: "user", text: "Why 30%?" });
    addMessage("other", { role: "user", text: "Hello" });
    expect(getChat()?.messages.map((message) => message.text)).toEqual([
      "Why 30%?",
    ]);
    expect(getChat("none")).toBeUndefined();
    expect(getChat(null as unknown as string)).toBeUndefined();
  });

  test("should drop the oldest messages over the limit", () => {
    for (let index = 0; index < MAX_CHAT_MESSAGES + 5; index++) {
      addMessage("tree", { role: "user", text: `Message ${index}` });
    }
    const messages = getChat()!.messages;
    expect(messages).toHaveLength(MAX_CHAT_MESSAGES);
    expect(messages[0]!.text).toBe("Message 5");
  });

  test("should update what became of an edit", () => {
    addMessage("tree", {
      role: "ai",
      text: "",
      edits: [
        {
          id: "edit",
          call: { name: "set_probabilities", args: {} },
          sentence: "Probabilities.",
          status: "waiting",
        },
      ],
    });
    updateEdit("tree", "edit", { status: "accepted", note: "$1 → $2" });
    expect(getChat()!.messages[0]!.edits![0]).toMatchObject({
      status: "accepted",
      note: "$1 → $2",
      call: { name: "set_probabilities" },
    });
  });

  test("should remove the latest messages from one on", () => {
    addMessage("tree", { role: "user", text: "First" });
    const id = addMessage("tree", { role: "user", text: "Second" });
    addMessage("tree", { role: "ai", text: "Reply" });
    useChatStore.getState().deleteMessagesFrom("tree", id);
    expect(getChat()!.messages.map((message) => message.text)).toEqual([
      "First",
    ]);
  });

  test("should refuse a case description that is too long", () => {
    expect(setSource("tree", { text: "x".repeat(MAX_SOURCE_LENGTH + 1) })).toBe(
      false,
    );
    expect(getChat()).toBeUndefined();
    expect(setSource("tree", { text: "Short", fileName: "case.pdf" })).toBe(
      true,
    );
    expect(getChat()!.source).toEqual({ text: "Short", fileName: "case.pdf" });
    expect(setSource("tree", undefined)).toBe(true);
    expect(getChat()!.source).toBeUndefined();
  });

  test("should keep the case description when the conversation is cleared", () => {
    setSource("tree", { text: "Case" });
    setIssues("tree", ["Issue?"]);
    setAliases("tree", { node: "n1" });
    addMessage("tree", { role: "user", text: "Hello" });
    useChatStore.getState().clearMessages("tree");
    expect(getChat()).toEqual({
      messages: [],
      aliases: { node: "n1" },
      source: { text: "Case" },
      issues: ["Issue?"],
    });
  });

  test("should not be saved with the trees", () => {
    setSource("tree", { text: "A confidential case description" });
    addMessage("tree", { role: "user", text: "A confidential question" });
    expect(window.localStorage.getItem("evtree-chat-v1")).toContain(
      "confidential case",
    );
    expect(JSON.stringify(useTreeStore.getState())).not.toContain(
      "confidential",
    );
  });

  test("should go when its tree is deleted", () => {
    const treeId = useTreeStore.getState().createTree("Tree");
    setSource(treeId, { text: "Case" });
    addMessage(treeId, { role: "user", text: "Hello" });
    useTreeStore.getState().deleteTree(treeId);
    expect(getChat(treeId)).toBeUndefined();
  });

  test("should stay in memory when it cannot be saved", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() =>
      addMessage("tree", { role: "user", text: "Hello" }),
    ).not.toThrow();
    expect(getChat()!.messages).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    setItem.mockRestore();
    warn.mockRestore();
  });
});
