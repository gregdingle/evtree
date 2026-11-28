/// <reference types="jest" />
import {
  ChatSearch,
  SearchModel,
  chatSearchDeclaration,
  getChatSearchText,
  parseChatSearchArgs,
  runChatSearch,
  startChatSearch,
} from "./chat-search";

jest.mock("nanoid", () => ({ nanoid: () => "id" }));

const args = {
  question: "What is the rate of prejudgment interest on a contract claim?",
  jurisdiction: "California",
};

const chunk = (domain: string, uri = `https://redirect.example/${domain}`) => ({
  web: { uri, domain, title: domain },
});

const SUGGESTIONS = "<style></style><div>Suggestions</div>";

/** A model that answers with what a search of Google would return */
function fakeSearchModel(
  answer: string,
  groundingMetadata?: object,
  fail?: string,
) {
  const requests: unknown[] = [];
  const model = {
    generateContent: async (request: unknown) => {
      requests.push(request);
      if (fail) {
        throw new Error(fail);
      }
      return {
        response: {
          text: () => answer,
          candidates: [{ groundingMetadata }],
        },
      };
    },
  } as unknown as SearchModel;
  return { model, requests };
}

const run = (model: SearchModel, signal?: AbortSignal) =>
  runChatSearch(model, startChatSearch(args), 3, signal);

describe("chatSearchDeclaration", () => {
  test("should declare the search to the AI in a form that it takes", () => {
    expect(chatSearchDeclaration.name).toBe("search_law");
    expect(chatSearchDeclaration.parameters).toMatchObject({
      type: "object",
      required: ["question", "jurisdiction"],
    });
    expect(chatSearchDeclaration.parameters).not.toHaveProperty("$schema");
    // NOTE: as for the tools that edit, see chat-tools.test.ts
    expect(JSON.stringify(chatSearchDeclaration.parameters)).not.toMatch(
      /"type":\[|anyOf|null/,
    );
  });

  test("should check the arguments of a call", () => {
    expect(parseChatSearchArgs(args)).toEqual({ args });
    expect(parseChatSearchArgs({ question: "What?" }).error).toBeDefined();
    expect(
      parseChatSearchArgs({ ...args, question: "x".repeat(301) }).error,
    ).toBeDefined();
  });
});

describe("runChatSearch", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should send only the question and the jurisdiction", async () => {
    const { model, requests } = fakeSearchModel("10 percent.");
    await run(model);
    expect(requests).toEqual([
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                type: "text",
                text: `Jurisdiction: California\nQuestion: ${args.question}`,
              },
            ],
          },
        ],
      },
    ]);
  });

  test("should return the sources, the sources of law first, with what each supports", async () => {
    const { model } = fakeSearchModel("10 percent. Under section 3289.", {
      groundingChunks: [
        chunk("ezel.ai"),
        chunk("www.Justia.com"),
        chunk("courts.ca.gov"),
      ],
      groundingSupports: [
        { segment: { text: "10 percent." }, groundingChunkIndices: [0, 1] },
        {
          segment: { text: "Under section 3289." },
          groundingChunkIndices: [1],
        },
      ],
      searchEntryPoint: { renderedContent: SUGGESTIONS },
    });
    const { search, response } = await run(model);
    expect(search).toEqual({
      id: "id",
      ...args,
      status: "found",
      answer: "10 percent. Under section 3289.",
      // NOTE: the ids are in the order that the search gave the pages
      sources: [
        {
          id: "s5",
          domain: "courts.ca.gov",
          uri: "https://redirect.example/courts.ca.gov",
          kind: "primary",
        },
        {
          id: "s4",
          domain: "justia.com",
          uri: "https://redirect.example/www.Justia.com",
          kind: "reference",
        },
        {
          id: "s3",
          domain: "ezel.ai",
          uri: "https://redirect.example/ezel.ai",
          kind: "other",
        },
      ],
      suggestionsHtml: SUGGESTIONS,
    });
    expect(response).toMatchObject({
      answer: "10 percent. Under section 3289.",
      sources: [
        { id: "s5", kind: "primary", citable: true, supports: [] },
        {
          id: "s4",
          kind: "reference",
          citable: true,
          supports: ["10 percent.", "Under section 3289."],
        },
        { id: "s3", kind: "other", citable: false, supports: ["10 percent."] },
      ],
    });
  });

  test("should leave out a link that is not https", async () => {
    const { model } = fakeSearchModel("10 percent.", {
      groundingChunks: [
        chunk("justia.com", "javascript:alert(1)"),
        chunk("courts.ca.gov", "http://courts.ca.gov"),
        chunk("law.cornell.edu"),
      ],
      searchEntryPoint: { renderedContent: SUGGESTIONS },
    });
    const { search } = await run(model);
    expect(search.sources.map((source) => source.domain)).toEqual([
      "law.cornell.edu",
    ]);
  });

  test.each([
    [
      "no sources",
      "10 percent.",
      { searchEntryPoint: { renderedContent: SUGGESTIONS } },
    ],
    ["no metadata", "10 percent.", undefined],
    [
      "no answer",
      "",
      {
        groundingChunks: [chunk("justia.com")],
        searchEntryPoint: { renderedContent: SUGGESTIONS },
      },
    ],
    [
      "no suggestions of Google",
      "10 percent.",
      { groundingChunks: [chunk("justia.com")] },
    ],
    [
      "suggestions that are too long",
      "10 percent.",
      {
        groundingChunks: [chunk("justia.com")],
        searchEntryPoint: { renderedContent: "x".repeat(20_001) },
      },
    ],
  ])("should not rely on an answer with %s", async (_, answer, metadata) => {
    const { model } = fakeSearchModel(answer, metadata);
    const { search, response } = await run(model);
    expect(search).toMatchObject({ status: "nothing", sources: [] });
    expect(search.suggestionsHtml).toBeUndefined();
    expect(response["answer"]).toBeUndefined();
    expect(response["result"]).toContain("found nothing");
  });

  test("should say that a search failed, and not throw", async () => {
    const { model } = fakeSearchModel("", undefined, "quota");
    const { search, response } = await run(model);
    expect(search).toMatchObject({ status: "failed", sources: [] });
    expect(response["error"]).toContain("failed");
  });

  test("should throw when it is stopped", async () => {
    const { model } = fakeSearchModel("", undefined, "aborted");
    const abortController = new AbortController();
    abortController.abort();
    await expect(run(model, abortController.signal)).rejects.toThrow("aborted");
  });
});

describe("getChatSearchText", () => {
  test("should say what a search found, with the ids of its sources", () => {
    const search: ChatSearch = {
      id: "id",
      ...args,
      status: "found",
      answer: "10 percent.",
      sources: [
        { id: "s1", domain: "justia.com", uri: "https://x", kind: "reference" },
      ],
    };
    expect(getChatSearchText(search)).toBe(
      `- Searched for "${args.question}" (California): 10 percent. Sources: s1 justia.com (reference).`,
    );
  });
});
