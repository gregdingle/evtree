import { cloneDeep } from "es-toolkit";
import { values } from "es-toolkit/compat";

import ageDefendant from "@/data/reference/age-discrimination-defendant-tree.json";
import componentSupply from "@/data/reference/component-supply-tree.json";
import defenseWithCosts from "@/data/reference/hapless-harvest-defense-with-costs-tree.json";
import patentInfringement from "@/data/reference/patent-infringement-tree.json";
import productLiability from "@/data/reference/product-liability-tree.json";

import {
  SOURCE_AI,
  SOURCE_DESCRIPTION,
  SOURCE_NOT_FOUND,
  SOURCE_SEARCH,
  convertAIStructureToDecisionTree,
  convertDecisionTreeToAIRows,
  getAIRowAliases,
  getAITreeDescription,
  getReasonWithSource,
  isQuoteInText,
  splitReasonSource,
} from "./ai-convert";
import { AINode, AITree, AITreeSchema } from "./ai-schemas";
import { createEdge } from "./edge";
import { arrangeSubtreeHelper } from "./layout";
import { getRootNodeIds } from "./maps";
import { createNode } from "./node";
import { DecisionTree } from "./tree";

const referenceTrees = [
  ageDefendant,
  componentSupply,
  defenseWithCosts,
  patentInfringement,
  productLiability,
] as unknown as DecisionTree[];

jest.mock("nanoid", () => {
  let nextId = 0;
  return { nanoid: () => `id-${++nextId}` };
});

const nodes: AINode[] = [
  {
    id: "n1",
    parentId: null,
    label: null,
    quote: null,
    reason: null,
    probability: null,
    question: "Does the settlement bar the claims?",
    value: null,
    cost: 100000,
  },
  {
    id: "n2",
    parentId: "n1",
    label: "Claims barred",
    quote: null,
    reason: "Because of the settlement",
    probability: 0.25,
    question: null,
    value: 0,
    cost: null,
  },
  {
    id: "n3",
    parentId: "n1",
    label: "Claims survive",
    quote: null,
    reason: "Because the settlement is narrow",
    probability: 0.75,
    question: null,
    value: null,
    cost: 200000,
  },
  {
    id: "n4",
    parentId: "n3",
    label: "Award",
    quote: null,
    reason: "Because it is the only outcome",
    probability: 1,
    question: null,
    value: -5000000,
    cost: null,
  },
];

function convert(aiNodes: AINode[], currency: AITree["currency"] = "USD") {
  const tree = convertAIStructureToDecisionTree(
    {
      currency,
      summary: "Summary.",
      issues: ["Issue?"],
      nodes: aiNodes,
      openQuestions: [],
    },
    "Name",
  );
  const edges = values(tree.edges);
  const getEdge = (label: string) =>
    edges.find((edge) => edge.data?.label === label)!;
  return { tree, edges, getEdge };
}

describe("convertAIStructureToDecisionTree", () => {
  test("should create a node per AI node and an edge per branch", () => {
    const { tree, edges } = convert(nodes);
    expect(tree.name).toBe("Name");
    expect(tree.description).toBe("Summary.");
    expect(values(tree.nodes)).toHaveLength(4);
    expect(edges).toHaveLength(3);
  });

  test("should connect each node to its parent", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    const survive = getEdge("Claims survive");
    const award = getEdge("Award");

    // The root is the source of both branches, and has no incoming edge
    expect(barred.source).toBe(survive.source);
    expect(award.source).toBe(survive.target);
    const rootNode = tree.nodes[barred.source]!;
    expect(rootNode.data.costExpr).toBe("100000");
    expect(values(tree.edges).some((e) => e.target === rootNode.id)).toBe(
      false,
    );
  });

  test("should copy the branch and node fields", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    expect(barred.data).toMatchObject({
      label: "Claims barred",
      description: "Because of the settlement",
      probabilityExpr: "0.25",
    });
    expect(tree.nodes[barred.target]!.data).toMatchObject({
      valueExpr: "0",
      costExpr: undefined,
    });
    const award = getEdge("Award");
    expect(tree.nodes[award.target]!.data.valueExpr).toBe("-5000000");
    expect(tree.nodes[award.source]!.data.costExpr).toBe("200000");
  });

  test("should keep the question of a node as its description", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    expect(tree.nodes[barred.source]!.data.description).toBe(
      "Does the settlement bar the claims?",
    );
    expect(tree.nodes[barred.target]!.data.description).toBe("");
  });

  test("should set node types from the number of child nodes", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    const award = getEdge("Award");
    expect(tree.nodes[barred.source]!.type).toBe("chance");
    expect(tree.nodes[barred.target]!.type).toBe("terminal");
    expect(tree.nodes[award.source]!.type).toBe("decision");
    expect(tree.nodes[award.target]!.type).toBe("terminal");
  });

  test("should set the currency, and rounding to match", () => {
    expect(convert(nodes).tree).toMatchObject({
      currency: "USD",
      rounding: "US",
    });
    expect(convert(nodes, "GBP").tree).toMatchObject({
      currency: "GBP",
      rounding: "UK",
    });
    const { tree } = convert(nodes, null);
    expect(tree.currency).toBeUndefined();
    expect(tree.rounding).toBe("US");
  });

  describe("description of the tree", () => {
    const aiTree: AITree = {
      currency: "USD",
      summary: " A buyer sues a seller. ",
      issues: [],
      nodes,
      openQuestions: [],
    };
    const date = new Date(2026, 10, 25);
    const on = date.toLocaleDateString(undefined, { dateStyle: "medium" });

    test("should be the summary and a line that names the file", () => {
      expect(
        getAITreeDescription(
          aiTree,
          { text: " one two\nthree ", fileName: "Statement.pdf" },
          date,
        ),
      ).toBe(
        `A buyer sues a seller.\n\nGenerated by AI on ${on} from Statement.pdf (3 words).`,
      );
    });

    test("should say pasted text without a file", () => {
      expect(getAITreeDescription(aiTree, { text: "one two" }, date)).toBe(
        `A buyer sues a seller.\n\nGenerated by AI on ${on} from pasted text (2 words).`,
      );
    });

    test("should not have the text itself", () => {
      const { description } = convertAIStructureToDecisionTree(aiTree, "Name", {
        text: "A confidential statement",
      });
      expect(description).toContain("A buyer sues a seller.");
      expect(description).not.toContain("confidential");
    });
  });

  describe("source of a reason", () => {
    const sourceText =
      "The parties settled in 2020.\nThe settlement \u201creleases all claims\u201d of the buyer.";
    const getDescriptions = (quotes: (string | null)[], text?: string) => {
      const aiNodes = nodes.map((node, index) => ({
        ...node,
        quote: quotes[index] ?? null,
      }));
      const tree = convertAIStructureToDecisionTree(
        {
          currency: "USD",
          summary: "Summary.",
          issues: ["Issue?"],
          nodes: aiNodes,
          openQuestions: [],
        },
        "Name",
        text === undefined ? undefined : { text },
      );
      return values(tree.edges).map((edge) => edge.data?.description);
    };

    test("should leave a reason as it is without the text that the AI was given", () => {
      expect(getDescriptions([null, "releases all claims"])).toEqual([
        "Because of the settlement",
        "Because the settlement is narrow",
        "Because it is the only outcome",
      ]);
    });

    test("should say where the point of each reason comes from", () => {
      expect(
        getDescriptions(
          [null, '"Releases all claims"', "releases some claims", null],
          sourceText,
        ),
      ).toEqual([
        `Because of the settlement\n\n${SOURCE_DESCRIPTION} "Releases all claims"`,
        `Because the settlement is narrow\n\n${SOURCE_NOT_FOUND} "releases some claims"`,
        `Because it is the only outcome\n\n${SOURCE_AI}`,
      ]);
    });

    test("should find a quote whatever its case, spacing and quotation marks", () => {
      expect(
        isQuoteInText('settled in 2020. The settlement "releases', sourceText),
      ).toBe(true);
      expect(isQuoteInText("settled in 2021", sourceText)).toBe(false);
      expect(isQuoteInText(" ", sourceText)).toBe(false);
    });

    test("should find a quote whatever its punctuation and hyphens", () => {
      const text =
        'The Court held, in 2020, that "[t]he pre-petition trans-\nfer was not a pur\u2010 chase" \u2014 at least in part.';
      expect(
        isQuoteInText(
          "the court held in 2020 that the prepetition transfer was not a purchase - at least in part",
          text,
        ),
      ).toBe(true);
      expect(isQuoteInText("The pre-petition transfer was not", text)).toBe(
        true,
      );
      // Not with a word left out or changed, or with part of a word
      expect(isQuoteInText("the transfer was a purchase", text)).toBe(false);
      expect(isQuoteInText("he pre-petition transfer", text)).toBe(false);
    });

    test("should find a quote that runs across a page break of a PDF", () => {
      const pages =
        "They contend that the Plan prohibits BlockFi from pursuing any claim\nPage 4 of 7\n===== page 5 =====\nStatement 2025-09-11\nregarding the Policy because it was assumed.";
      expect(
        isQuoteInText(
          "the Plan prohibits BlockFi from pursuing any claim regarding the Policy because it was assumed.",
          pages,
        ),
      ).toBe(true);
      // Not a quote that is put together from words that are far apart
      expect(isQuoteInText("They contend it was assumed", pages)).toBe(false);
      expect(
        isQuoteInText("the Plan prohibits BlockFi from winning", pages),
      ).toBe(false);
    });

    test("should find a quote that leaves out words with an ellipsis, in any order", () => {
      expect(
        isQuoteInText("The parties settled ... of the buyer.", sourceText),
      ).toBe(true);
      expect(
        isQuoteInText("of the buyer \u2026 The parties settled", sourceText),
      ).toBe(true);
      // Not when one of the parts is not in the text
      expect(
        isQuoteInText("The parties settled ... of the seller", sourceText),
      ).toBe(false);
    });
  });

  describe("order of the branches", () => {
    const row = (
      id: string,
      parentId: string | null,
      probability: number | null,
      value: number | null,
    ): AINode => ({
      id,
      parentId,
      label: parentId && id,
      quote: null,
      reason: parentId && "Because",
      probability,
      question: value === null ? "Question?" : null,
      value,
      cost: null,
    });

    function getOrder(aiNodes: AINode[], parentLabel?: string) {
      const { tree, edges, getEdge } = convert(aiNodes);
      const parentId = parentLabel
        ? getEdge(parentLabel).target
        : values(tree.nodes).find(
            (node) => !edges.some((edge) => edge.target === node.id),
          )!.id;
      return edges
        .filter((edge) => edge.source === parentId)
        .sort(
          (a, b) =>
            tree.nodes[a.target]!.position.y - tree.nodes[b.target]!.position.y,
        )
        .map((edge) => edge.data?.label);
    }

    test("should put the branch that continues before the one that ends at nothing", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("no liability", "root", 0.4, 0),
        row("liability", "root", 0.6, null),
        row("low", "liability", 0.25, 100),
        row("mid", "liability", 0.5, 200),
        row("high", "liability", 0.25, 400),
      ];
      expect(getOrder(aiNodes)).toEqual(["liability", "no liability"]);
      expect(getOrder(aiNodes, "liability")).toEqual(["high", "mid", "low"]);
    });

    test("should put the largest payment first in a tree for the defendant", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("no liability", "root", 0.4, 0),
        row("liability", "root", 0.6, null),
        row("low", "liability", 0.5, -100),
        row("high", "liability", 0.5, -400),
      ];
      expect(getOrder(aiNodes)).toEqual(["liability", "no liability"]);
      expect(getOrder(aiNodes, "liability")).toEqual(["high", "low"]);
    });

    test("should keep the order when the tree is arranged", () => {
      const { tree, getEdge } = convert([
        row("root", null, null, null),
        row("no liability", "root", 0.4, 0),
        row("liability", "root", 0.6, null),
        row("low", "liability", 0.5, 100),
        row("high", "liability", 0.5, 400),
      ]);
      arrangeSubtreeHelper(tree, getEdge("liability").source);
      const getY = (label: string) =>
        tree.nodes[getEdge(label).target]!.position.y;
      expect(getY("high")).toBeLessThan(getY("low"));
      expect(getY("low")).toBeLessThan(getY("no liability"));
    });

    test("should weigh a branch by the probabilities of what follows it", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("likely", "root", 0.5, null),
        row("likely win", "likely", 0.9, 100),
        row("likely loss", "likely", 0.1, 0),
        row("unlikely", "root", 0.5, null),
        row("unlikely loss", "unlikely", 0.9, 0),
        row("unlikely win", "unlikely", 0.1, 500),
      ];
      // NOTE: 0.9 × 100 is more than 0.1 × 500
      expect(getOrder(aiNodes)).toEqual(["likely", "unlikely"]);
    });

    test("should keep the order of the AI between branches of the same size", () => {
      const aiNodes = [
        row("root", null, null, null),
        row("second claim", "root", 0.3, 100),
        row("neither claim", "root", 0.4, 0),
        row("first claim", "root", 0.3, 100),
      ];
      expect(getOrder(aiNodes)).toEqual([
        "second claim",
        "first claim",
        "neither claim",
      ]);
    });
  });

  test("should not depend on the order of the AI nodes", () => {
    const { tree, edges, getEdge } = convert([...nodes].reverse());
    expect(values(tree.nodes)).toHaveLength(4);
    expect(edges).toHaveLength(3);
    expect(getEdge("Award").source).toBe(getEdge("Claims survive").target);
  });
});

describe("splitReasonSource", () => {
  test("should take each footnote back off", () => {
    expect(
      splitReasonSource(`Because.\n\n${SOURCE_DESCRIPTION} "all claims"`),
    ).toEqual({
      reason: "Because.",
      quote: "all claims",
      source: "description",
    });
    expect(
      splitReasonSource(`Because.\n\n${SOURCE_NOT_FOUND} "some claims"`),
    ).toEqual({ reason: "Because.", quote: "some claims", source: "notFound" });
    expect(splitReasonSource(`Because.\n\n${SOURCE_AI}`)).toEqual({
      reason: "Because.",
      quote: null,
      source: "ai",
    });
    expect(
      splitReasonSource(`Because.\n\n${SOURCE_SEARCH} law.cornell.edu`),
    ).toEqual({
      reason: "Because.",
      quote: null,
      source: "search",
      searchDomain: "law.cornell.edu",
    });
    // The source of a search goes before a quote, and needs no description
    expect(
      getReasonWithSource("Because.", "a quote", undefined, "justia.com"),
    ).toBe(`Because.\n\n${SOURCE_SEARCH} justia.com`);
    expect(getReasonWithSource("", null, "Text.", "justia.com")).toBe("");
  });

  test("should leave a reason without a footnote as it is", () => {
    expect(splitReasonSource("First.\n\nSecond.")).toEqual({
      reason: "First.\n\nSecond.",
      quote: null,
      source: null,
    });
    expect(splitReasonSource(undefined)).toEqual({
      reason: "",
      quote: null,
      source: null,
    });
  });

  test("should be the reverse of getReasonWithSource", () => {
    const text = "The settlement releases all claims of the buyer.";
    for (const quote of ["releases all claims", "releases no claims", null]) {
      const description = getReasonWithSource(
        "Because.\n\nAnd so.",
        quote,
        text,
      );
      expect(splitReasonSource(description)).toMatchObject({
        reason: "Because.\n\nAnd so.",
        quote,
      });
    }
  });
});

describe("convertDecisionTreeToAIRows", () => {
  const getRows = (tree: DecisionTree, aliases = getAIRowAliases(tree)) =>
    convertDecisionTreeToAIRows(tree, aliases);

  test("should give back the rows that a tree was made from", () => {
    const sourceText = "The settlement releases all claims of the buyer.";
    const aiNodes = nodes.map((node) =>
      node.id === "n2" ? { ...node, quote: "releases all claims" } : node,
    );
    const tree = convertAIStructureToDecisionTree(
      {
        currency: "USD",
        summary: "Summary.",
        issues: [],
        nodes: aiNodes,
        openQuestions: [],
      },
      "Name",
      { text: sourceText },
    );
    // NOTE: the survive branch leads to the larger amount, so it comes first
    expect(getRows(tree)).toEqual([
      { ...aiNodes[0], id: "n1" },
      { ...aiNodes[2], id: "n2", parentId: "n1" },
      { ...aiNodes[3], id: "n3", parentId: "n2" },
      { ...aiNodes[1], id: "n4", parentId: "n1" },
    ]);
  });

  test("should keep the short id of a node, and never use one again", () => {
    const { tree } = convert(nodes);
    const aliases = getAIRowAliases(tree);
    const [rootId, , , barredId] = Object.keys(aliases).sort((a, b) =>
      aliases[a]!.localeCompare(aliases[b]!),
    );
    expect(aliases[barredId!]).toBe("n4");

    // Delete the last node, and add another
    const smaller = cloneDeep(tree);
    delete smaller.nodes[barredId!];
    delete smaller.edges[`e${rootId}-${barredId}`];
    smaller.nodes["new"] = { ...tree.nodes[barredId!]!, id: "new" };
    smaller.edges["new"] = {
      ...tree.edges[`e${rootId}-${barredId}`]!,
      id: "new",
      target: "new",
    };
    const next = getAIRowAliases(smaller, aliases);
    expect(next).toMatchObject(aliases);
    expect(next["new"]).toBe("n5");
    expect(getRows(smaller, next).map((row) => row.id)).toEqual([
      "n1",
      "n2",
      "n3",
      "n5",
    ]);
  });

  test("should work out an expression, unless it uses a variable", () => {
    const { tree, getEdge } = convert(nodes);
    const barred = getEdge("Claims barred");
    barred.data!.probabilityExpr = "25%";
    getEdge("Claims survive").data!.probabilityExpr = "3/4";
    tree.nodes[barred.target]!.data.valueExpr = "claim * 0.5";
    tree.nodes[barred.target]!.data.costExpr = "$1,000";
    expect(getRows(tree)[1]).toMatchObject({ probability: 0.75 });
    expect(getRows(tree).at(-1)).toMatchObject({
      probability: 0.25,
      value: "claim * 0.5",
      cost: 1000,
    });
  });

  test("should leave out notes and arrows", () => {
    const { tree } = convert(nodes);
    const rootId = getRootNodeIds(tree.nodes, tree.edges)[0]!;
    tree.nodes["note"] = createNode({ x: 0, y: 0 }, "note", false);
    tree.nodes["ghost"] = createNode({ x: 0, y: 0 }, "ghost", false);
    tree.edges["arrow"] = createEdge(rootId, "ghost", false, {}, "arrow");
    expect(getRows(tree)).toHaveLength(4);
  });

  test.each(referenceTrees)(
    "should give a row for every node of the reference tree $name",
    (tree) => {
      const rows = getRows(tree);
      expect(rows).toHaveLength(values(tree.nodes).length);
      const ids = new Set(rows.map((row) => row.id));
      expect(ids.size).toBe(rows.length);
      expect(rows.filter((row) => row.parentId === null)).toHaveLength(1);
      rows.forEach((row, index) => {
        if (row.parentId !== null) {
          // A row comes after its parent
          expect(rows.findIndex((r) => r.id === row.parentId)).toBeLessThan(
            index,
          );
          expect(typeof row.probability).toBe("number");
        }
      });
      // NOTE: the rows pass the checks of a tree from AI, apart from the
      // reasons, which the reference trees do not have
      const result = AITreeSchema.safeParse({
        currency: null,
        summary: "",
        issues: [],
        nodes: rows.map((row) => ({ ...row, reason: row.reason || "None" })),
        openQuestions: [],
      });
      expect(result.error?.issues ?? []).toEqual([]);
    },
  );
});
