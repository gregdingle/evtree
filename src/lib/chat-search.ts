import { omit } from "es-toolkit";
import type { GenerativeModel } from "firebase/ai";
import { nanoid } from "nanoid";
import z from "zod";

import { SourceKind, getSourceKind, isCitable } from "./legal-sources";

/**
 * The search of the chat with AI: the AI of the chat asks a legal question,
 * and a request of its own answers it from Google Search.
 *
 * NOTE: why a request apart from the chat, and not Google Search as one more
 * tool of the chat itself?
 * - What the search returns is sorted here, in code, by the list in
 *   legal-sources.ts, before the AI of the chat sees it.
 * - The request that searches has only the question and the jurisdiction. It
 *   has no tree, no case description and no conversation, so the names and
 *   the facts of a case are in a search only if the AI of the chat put them
 *   in the question, and the chat shows the question.
 * - Google Search next to tools that are functions, in one request, is a
 *   preview of the AI service. It was accepted once by gemini-3.8-flash, but
 *   never seen to search.
 * It costs one more request for a search, of 3 to 5 seconds when tried.
 *
 * NOTE: the use cases, in the order of how well an answer can be checked:
 * look up the legal test of an issue, and look up an amount or a period that
 * is set by statute, like a cap, a rate of interest or a limitation period.
 * Finding precedents is not one of them yet, see the first TODO.
 *
 * TODO: CourtListener, of the Free Law Project, for the case law of the
 * United States: check that each case that a case description cites exists,
 * with its citation lookup, which takes up to 250 citations in a request, and
 * get the text of an opinion, so that a quote of it can be checked with
 * isQuoteInText like a quote of the case description. It is where a made-up
 * citation is the real danger. It needs a token of an account, so a route on
 * a server to keep the token, which the app does not have. The limits of a
 * free account were about 125 requests a day when looked up in November 2026,
 * with more by a paid membership, and use in a product may need an agreement
 * with the Free Law Project. To ask them first.
 *
 * TODO: read the page of a source, to check the words of a statute against
 * it, so that a footnote could say that a point was checked. The AI service
 * has a tool that reads a URL, urlContext. A request with it next to
 * googleSearch was accepted, and quoted a section of a statute rightly, but
 * gave no sign that it had read a page. The text of the page would have to
 * come back for isQuoteInText to check a quote against.
 *
 * TODO: the address and the title of each page, on a route on a server that
 * follows the link of Google to the page and keeps where it leads. The
 * search gives only the site of a page and a link of Google, which leads to
 * the page itself but stops working after some days, so the links of an old
 * chat break, and the chat can show only the site. A browser cannot read
 * where the link of another site leads. The same route on a server as for
 * CourtListener, above.
 *
 * TODO: a search of a set list of sites only, in place of sorting what a
 * search of the whole web returns. Google has that as a product of its own,
 * which needs a backend.
 *
 * TODO: a search cannot say whether a case is still good law. The prompt of
 * the chat has the AI say so, see chat-prompt.md. A citator is what would.
 */

/** A page that a search found */
export interface ChatSearchSource {
  /** A short id for the AI, like "s1", which is unique in a chat */
  id: string;
  /** The domain of the site, like "law.cornell.edu" */
  domain: string;
  /**
   * The link to the page.
   *
   * NOTE: a link of Google that leads on to the page, and that stops working
   * after some days. The address of the page itself is not given.
   */
  uri: string;
  kind: SourceKind;
}

/** A search for the AI of the chat, and what came of it */
export interface ChatSearch {
  id: string;
  question: string;
  jurisdiction: string;
  /**
   * - searching: not back yet
   * - found: answered, with sources
   * - nothing: answered without a source, so not to be relied on
   * - failed: the request failed
   */
  status: "searching" | "found" | "nothing" | "failed";
  /** The answer of the AI that searched, or why the search failed */
  answer: string;
  sources: ChatSearchSource[];
  /**
   * The searches that Google suggests to go on from, as HTML of Google.
   *
   * NOTE: the terms of grounding with Google Search ask that this is shown
   * with an answer that came of a search. It is shown as it is, in a frame
   * that cannot run scripts, see ChatMessage.tsx.
   */
  suggestionsHtml?: string;
}

/** How many searches the AI may make to answer one message of the user */
export const MAX_SEARCHES = 2;

/** More than this is not kept, and then the answer is not shown as found */
const MAX_SUGGESTIONS_LENGTH = 20_000;

export const SEARCH_TOOL_NAME = "search_law";

const searchArgs = z.object({
  question: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "One legal question in general terms, such as what the test for an issue is, or what amount or period a statute sets. Without the names of the parties or the facts of the case.",
    ),
  jurisdiction: z
    .string()
    .min(1)
    .max(100)
    .describe(
      "Whose law the question is about, such as California, or England and Wales.",
    ),
});

export type ChatSearchArgs = z.infer<typeof searchArgs>;

/** The search as a function declaration for the AI of the chat */
export const chatSearchDeclaration = {
  name: SEARCH_TOOL_NAME,
  description:
    "Searches the web for the answer to one legal question, and returns the answer with its sources. The answer is not checked.",
  parameters: omit(z.toJSONSchema(searchArgs), ["$schema"]),
};

/** The part of the model of the AI that a search needs, which a test can fake */
export type SearchModel = Pick<GenerativeModel, "generateContent">;

/** Returns the arguments of a call of the search, or what is wrong with them */
export function parseChatSearchArgs(
  args: unknown,
): { args: ChatSearchArgs; error?: undefined } | { error: string } {
  // NOTE: what the AI writes is checked like any other input
  const parsed = searchArgs.safeParse(args);
  return parsed.success
    ? { args: parsed.data }
    : { error: z.prettifyError(parsed.error) };
}

/** Returns a search that has just been sent, to show while it runs */
export function startChatSearch(args: ChatSearchArgs): ChatSearch {
  return {
    id: nanoid(12),
    ...args,
    status: "searching",
    answer: "",
    sources: [],
  };
}

/**
 * Searches for the answer to a question, and returns the search with what
 * came of it, and what to tell the AI of the chat.
 *
 * Nothing is thrown, except when the search is stopped by the signal.
 *
 * @param nextSourceNumber - The number of the first new source, so that the
 * ids of the sources are unique in a chat
 */
export async function runChatSearch(
  model: SearchModel,
  search: ChatSearch,
  nextSourceNumber: number,
  signal?: AbortSignal,
): Promise<{ search: ChatSearch; response: Record<string, unknown> }> {
  let answer: string;
  let metadata;
  try {
    const { response } = await model.generateContent(
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                type: "text",
                text: `Jurisdiction: ${search.jurisdiction}\nQuestion: ${search.question}`,
              },
            ],
          },
        ],
      },
      { signal },
    );
    answer = response.text().trim();
    metadata = response.candidates?.[0]?.groundingMetadata;
  } catch (caught) {
    if (signal?.aborted) {
      throw caught;
    }
    console.error("[EVTree] AI search failed", caught);
    return {
      search: { ...search, status: "failed", answer: "The search failed." },
      response: { error: "The search failed. Tell the user." },
    };
  }

  // NOTE: what each source is said to support, which is told to the AI of
  // the chat, so that it cites a source for what came from it
  const supports: Record<number, string[]> = {};
  metadata?.groundingSupports?.forEach((support) => {
    support.groundingChunkIndices?.forEach((index) => {
      if (support.segment?.text) {
        (supports[index] ??= []).push(support.segment.text);
      }
    });
  });
  const sources: (ChatSearchSource & { supports: string[] })[] = [];
  metadata?.groundingChunks?.forEach((chunk, index) => {
    const { uri, domain, title } = chunk.web ?? {};
    // NOTE: only a link of the web that is secure, because it is shown as a
    // link, see ChatMessage.tsx. The title has been the domain when tried,
    // and stands in for it.
    if (!uri?.startsWith("https://") || !(domain || title)) {
      return;
    }
    sources.push({
      id: `s${nextSourceNumber + sources.length}`,
      domain: (domain || title)!.toLowerCase().replace(/^www\./, ""),
      uri,
      kind: getSourceKind(domain || title),
      supports: supports[index] ?? [],
    });
  });
  // NOTE: the sources of law first, which is the order that they are shown in
  const rank = { primary: 0, reference: 1, other: 2 };
  sources.sort((a, b) => rank[a.kind] - rank[b.kind]);

  const html = metadata?.searchEntryPoint?.renderedContent;
  const suggestionsHtml =
    html && html.length <= MAX_SUGGESTIONS_LENGTH ? html : undefined;
  // NOTE: without a source, the answer is from the memory of the AI, which
  // is what a search is there to do better than. And without the suggestions
  // of Google, an answer from a search may not be shown.
  if (!answer || sources.length === 0 || !suggestionsHtml) {
    return {
      search: {
        ...search,
        status: "nothing",
        answer: "The search found nothing to rely on.",
      },
      response: {
        result:
          "The search found nothing to rely on. Tell the user. Do not answer the question from memory as if it had been looked up.",
      },
    };
  }
  return {
    search: {
      ...search,
      status: "found",
      answer,
      sources: sources.map((source) => omit(source, ["supports"])),
      suggestionsHtml,
    },
    response: {
      answer,
      sources: sources.map(({ id, domain, kind, supports }) => ({
        id,
        domain,
        kind,
        citable: isCitable(kind),
        supports,
      })),
      note: "The answer is not checked. The user sees the question and the sources. Only a source that is citable may be given as the sourceId of a reason.",
    },
  };
}

/** Returns a search in words for the AI, for a later turn of the chat */
export function getChatSearchText(search: ChatSearch): string {
  const sources = search.sources
    .map((source) => `${source.id} ${source.domain} (${source.kind})`)
    .join(", ");
  return `- Searched for "${search.question}" (${search.jurisdiction}): ${search.answer}${sources ? ` Sources: ${sources}.` : ""}`;
}
