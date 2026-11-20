import { isPlainObject, memoize } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";
import { AgentPlatformBackend, getAI, getGenerativeModel } from "firebase/ai";

import { createEdge } from "@/lib/edge";
import { createNode } from "@/lib/node";
import { createTree } from "@/lib/tree";

import { BranchShape, NodeSchema, NodeShape } from "./ai-schemas";
import aiSchemasText from "./ai-schemas.md";
import { AppEdge } from "./edge";
import { firebaseApp } from "./firebase";
import { AppNode } from "./node";
import promptTemplate from "./prompt.md";
import { DecisionTree } from "./tree";

// HACK: ai-schemas.md is not actually markdown, it's a hardlink to have the TS
// file loaded by the raw-loader as text... could we use ai-schemas?raw instead?

function getAIModel() {
  // NOTE: Callers of the functions in this file should check that firebaseApp exists.
  if (!firebaseApp) {
    throw new Error("[EVTree] Firebase app is not initialized");
  }
  return getGenerativeModel(
    // NOTE: AgentPlatformBackend is the renamed VertexAIBackend in firebase 13.
    // It defaults to the "global" location, recommended by Firebase, where the
    // old VertexAIBackend defaulted to "us-central1".
    getAI(firebaseApp, { backend: new AgentPlatformBackend() }),
    {
      // NOTE: gemini-2.0 models were shut down June 1, 2026 and gemini-2.5
      // models October 20, 2026. gemini-3.8-flash is Firebase's recommended
      // stable model with no shutdown date, see
      // https://firebase.google.com/docs/ai-logic/models
      // TODO: compare results with the prompt, which was tuned for
      // gemini-2.0-flash ("follows example much better than gemini-2.5")
      model: "gemini-3.8-flash",
    },
  );
}

/**
 * Extracts plain text from a file using AI
 */
export async function extractTextFromFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
Please extract all plain text content from this document.
Return only the extracted text content without any formatting, headers, or explanations.
Put two newlines between paragraphs. Replace newlines within a paragraph with a single space.
Focus on extracting the actual readable text content that would be relevant for legal document analysis.
Ignore footnotes.
    `.trim();

    // Generate content with the file data
    const result = await getAIModel().generateContent([
      {
        type: "text",
        text: prompt,
      },
      {
        // QUESTION: use FileDataPart instead?
        type: "inlineData",
        inlineData: {
          mimeType: file.type,
          data: base64,
        },
      },
    ]);

    const extractedText = result.response
      .text()
      .trim()
      // Clean up paragraphs
      .replaceAll(/\n{2,}/g, "~TEMP~")
      .replaceAll(/\n/g, " ")
      .replaceAll("~TEMP~", "\n\n");

    if (!extractedText) {
      throw new Error("No text could be extracted from the file");
    }

    return extractedText;
  } catch (error) {
    throw new Error(`Failed to extract text from file: ${error}`);
  }
}

// NOTE: memoize to avoid spamming service
// QUESTION: maybe throttle would be better?
const generateDecisionTreeMemoized = memoize(async function (
  text: string,
): Promise<NodeShape> {
  try {
    // Get the prompt template from markdown file and replace the placeholder
    const prompt = promptTemplate
      .replace("{{CASE_DESCRIPTION}}", text)
      .replace("{{ZOD_SCHEMAS}}", aiSchemasText);

    // Generate the decision tree using AI
    const result = await getAIModel().generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    // Extract JSON from the response (it might be wrapped in markdown code blocks)
    const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/) ||
      generatedText.match(/```\s*([\s\S]*?)\s*```/) || [null, generatedText];

    if (!jsonMatch[1]) {
      throw new Error("[EVTree] No JSON found in AI response");
    }

    const jsonText = jsonMatch[1].trim();

    // Parse the JSON response
    let decisionTree: DecisionTree;
    try {
      decisionTree = JSON.parse(jsonText);
    } catch (parseError) {
      throw new Error(
        `[EVTree] Failed to parse AI response as JSON: ${parseError}`,
      );
    }

    // Sanity check that we have a structure
    if (!isPlainObject(decisionTree) || isEmpty(decisionTree)) {
      throw new Error(
        "[EVTree] Invalid decision tree structure returned by AI",
      );
    }

    return NodeSchema.parse(decisionTree);
  } catch (error) {
    // QUESTION: should we retry schema parse failures? maybe with a different model or settings?
    throw error;
  }
});

/**
 * Creates a decision tree from a text description using AI.
 *
 * @param text - The case description to convert into a decision tree
 * @returns Promise<Decision> - The generated decision tree structure
 */
export async function generateDecisionTree(text: string): Promise<NodeShape> {
  try {
    return await generateDecisionTreeMemoized(text);
  } catch (error) {
    // NOTE: don't cache failures, so that the user can retry
    generateDecisionTreeMemoized.cache.delete(text);
    throw error;
  }
}

/**
 * Converts AI-generated hierarchical NodeShape structure to flat DecisionTree format
 */
export function convertAIStructureToDecisionTree(
  rootNode: NodeShape,
  name: string,
  description: string,
): DecisionTree {
  // NOTE: ignore positions because auto-arrange after
  const dummyPosition = { x: 0, y: 0 };

  const nodes: Record<string, AppNode> = {};
  const edges: Record<string, AppEdge> = {};
  function processNodeAndBranch(
    node: NodeShape,
    branch?: BranchShape,
    parentId?: string,
  ): void {
    // Determine node type based on whether it has branches
    // TODO: we shouldn't really define decision nodes this way... either
    // exclude decision node, or else modify the prompt and AI schemas to return
    // decision nodes
    let nodeType: "decision" | "chance" | "terminal";
    if (node.branches.length === 0) {
      nodeType = "terminal";
    } else if (node.branches.length === 1) {
      nodeType = "decision";
    } else {
      nodeType = "chance";
    }

    // Create the node
    const appNode = createNode(dummyPosition, nodeType, false, {
      description: "",
      // NOTE: convert to string which will be converted back to number internally
      valueExpr: node.value?.toString() || undefined,
      costExpr: node.cost?.toString() || undefined,
    });

    nodes[appNode.id] = appNode;

    // Create edge from parent if there is one
    if (parentId) {
      const edge = createEdge(parentId, appNode.id, false, {
        label: branch?.label || "",
        // NOTE: convert to string which will be converted back to number internally
        probabilityExpr: branch?.probability?.toString() || undefined,
        description: branch?.reason || "",
      });
      edges[edge.id] = edge;
    }

    // Process child branches
    node.branches.forEach((branch) => {
      processNodeAndBranch(branch.nextNode, branch, appNode.id);
    });
  }

  // Process all nodes
  processNodeAndBranch(rootNode);

  return createTree(name, description, nodes, edges);
}
