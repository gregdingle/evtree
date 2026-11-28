"use client";

import { nanoid } from "nanoid";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";

import type { AIRowAliases, AISource } from "@/lib/ai-convert";
import type { ChatToolCall, ChatToolTarget } from "@/lib/chat-tools";

/**
 * The store of the chats with AI: for each tree, the conversation, and what
 * the AI needs to know of how the tree was generated.
 *
 * NOTE: why a store of its own, and not a field of a tree in the tree store?
 * A tree goes whole into its JSON export, its share link, its duplicates and
 * the undo history, see cleanTree in export.ts and selectUndoableState. A
 * conversation about a case is confidential, and so may be the case
 * description, like a mediation statement. Here they are in none of those,
 * and no one has to remember to leave them out.
 *
 * NOTE: this store never changes a tree. Only a tool of the chat does, see
 * chat-tools.ts.
 *
 * TODO: let the user export a conversation, if asked for, as a note to the
 * file of why a number was changed.
 *
 * TODO: the conversations share the storage of the browser with the trees,
 * which holds about 5 MB. Hence the limits below. Move to IndexedDB if they
 * are in the way.
 */

/** A call of a tool by the AI, and what became of it */
export interface ChatEdit {
  id: string;
  call: ChatToolCall;
  /** The edit as a sentence, see describe in chat-tools.ts */
  sentence: string;
  /**
   * - done: made at once, because the user asked for it
   * - waiting: for the user to accept or reject
   * - accepted: made after the user accepted
   * - rejected: by the user
   * - failed: accepted, but it no longer fit the tree
   */
  status: "done" | "waiting" | "accepted" | "rejected" | "failed";
  /** What came of the edit, like the expected value before and after */
  note?: string;
  /** What a click on the edit selects on the canvas */
  target?: ChatToolTarget;
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  edits?: ChatEdit[];
  /** For a reply that failed, in place of its text */
  error?: string;
  createdAt: string;
}

export interface Chat {
  messages: ChatMessage[];
  /**
   * The short id of each node of the tree, which is how the AI names nodes.
   * They are kept so that they stay the same for the life of a chat, see
   * getAIRowAliases.
   */
  aliases: AIRowAliases;
  /** The case description that the tree was made from, if the user kept it */
  source?: AISource;
  /** The issues that the AI listed when it generated the tree */
  issues?: string[];
}

/** The messages kept for a tree. Older ones are dropped. */
export const MAX_CHAT_MESSAGES = 50;

/**
 * The longest case description that is kept, in characters, of which the
 * storage of the browser takes two bytes each
 */
export const MAX_SOURCE_LENGTH = 500_000;

const emptyChat = (): Chat => ({ messages: [], aliases: {} });

export interface ChatStoreState {
  chats: Record<string, Chat>;

  /** Adds a message to the chat of a tree, and returns its id */
  addMessage: (
    treeId: string,
    message: Omit<ChatMessage, "id" | "createdAt">,
  ) => string;
  updateEdit: (
    treeId: string,
    editId: string,
    update: Partial<Omit<ChatEdit, "id" | "call">>,
  ) => void;
  setAliases: (treeId: string, aliases: AIRowAliases) => void;
  /**
   * Keeps the case description of a tree, or removes it. Returns false, and
   * keeps nothing, if it is too long.
   */
  setSource: (treeId: string, source: AISource | undefined) => boolean;
  setIssues: (treeId: string, issues: string[]) => void;
  /** Removes the latest messages of a tree, from a message on */
  deleteMessagesFrom: (treeId: string, messageId: string) => void;
  /** Removes the conversation of a tree, and keeps its case description */
  clearMessages: (treeId: string) => void;
  /** Removes everything that is kept for a tree */
  deleteChat: (treeId: string) => void;
}

export const useChatStore = createWithEqualityFn<ChatStoreState>()(
  persist(
    immer((set) => ({
      chats: {},

      addMessage: (treeId, message) => {
        const id = nanoid(12);
        set((state) => {
          const chat = (state.chats[treeId] ??= emptyChat());
          chat.messages.push({
            ...message,
            id,
            createdAt: new Date().toISOString(),
          });
          chat.messages.splice(0, chat.messages.length - MAX_CHAT_MESSAGES);
        });
        return id;
      },

      updateEdit: (treeId, editId, update) =>
        set((state) => {
          const edit = state.chats[treeId]?.messages
            .flatMap((message) => message.edits ?? [])
            .find((edit) => edit.id === editId);
          if (edit) {
            Object.assign(edit, update);
          }
        }),

      setAliases: (treeId, aliases) =>
        set((state) => {
          (state.chats[treeId] ??= emptyChat()).aliases = aliases;
        }),

      setSource: (treeId, source) => {
        if (source && source.text.length > MAX_SOURCE_LENGTH) {
          return false;
        }
        set((state) => {
          (state.chats[treeId] ??= emptyChat()).source = source;
        });
        return true;
      },

      setIssues: (treeId, issues) =>
        set((state) => {
          (state.chats[treeId] ??= emptyChat()).issues = issues;
        }),

      deleteMessagesFrom: (treeId, messageId) =>
        set((state) => {
          const messages = state.chats[treeId]?.messages;
          const index = messages?.findIndex((m) => m.id === messageId) ?? -1;
          if (index !== -1) {
            messages!.splice(index);
          }
        }),

      clearMessages: (treeId) =>
        set((state) => {
          const chat = state.chats[treeId];
          if (chat) {
            chat.messages = [];
          }
        }),

      deleteChat: (treeId) =>
        set((state) => {
          delete state.chats[treeId];
        }),
    })),
    {
      name: "evtree-chat-v1",
      storage: createJSONStorage(() => ({
        getItem: (name) => window.localStorage.getItem(name),
        removeItem: (name) => window.localStorage.removeItem(name),
        // NOTE: a chat that cannot be saved, like when the storage of the
        // browser is full, must not break the app. It stays in memory until
        // the page is left.
        setItem: (name, value) => {
          try {
            window.localStorage.setItem(name, value);
          } catch (error) {
            console.warn("[EVTree] Failed to save the chats", error);
          }
        },
      })),
    },
  ),
  shallow,
);

/** Returns the chat of a tree, if it has one */
export function selectChat(
  state: ChatStoreState,
  treeId: string | null | undefined,
): Chat | undefined {
  return state.chats[treeId ?? ""];
}
