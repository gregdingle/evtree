import { getAI, getGenerativeModel, VertexAIBackend } from "firebase/ai";
import { initializeApp } from "firebase/app";

import { DecisionTree } from "@/hooks/use-store";
import { memoize } from "es-toolkit";
// TODO: proper typing of raw import
// @ts-expect-error: see next-config.ts for raw-loader setup
import promptTemplate from "./prompt.md";

// TODO: Add SDKs for Firebase products that you want to use
// TODO: appCheck?
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDLUkNaafYJGdQAJJOH1vpV_RjmtceP8oY",
  // TODO: create a new project for evtree and use the new API key
  authDomain: "bkcy-1.firebaseapp.com",
  projectId: "bkcy-1",
  storageBucket: "bkcy-1.appspot.com",
  messagingSenderId: "460046349482",
  appId: "1:460046349482:web:d76c96a7dba44b0dddccd3",
};

const firebaseApp = initializeApp(firebaseConfig);

const AIModel = getGenerativeModel(
  getAI(firebaseApp, { backend: new VertexAIBackend() }),
  {
    // QUESTION: is this the right model?
    // NOTE: see https://firebase.google.com/docs/ai-logic/models?authuser=0
    // model: "gemini-2.5-pro", // way too slow, but good looking results, maybe too big
    // model: "gemini-2.5-flash", // slower than gemini-2.0, some useless results
    model: "gemini-2.0-flash", // follows example much better than gemini-2.5
    // model: "gemini-2.5-flash-lite", // untested
  },
);

/**
 * Extracts plain text from a file using AI
 * @param file - The file to extract text from
 * @returns Promise<string> - The extracted plain text
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
    const result = await AIModel.generateContent([
      {
        text: prompt,
      },
      {
        // QUESTION: use FileDataPart instead?
        inlineData: {
          mimeType: file.type,
          data: base64,
        },
      },
    ]);

    const response = await result.response;
    const extractedText = response
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
    console.error("Error extracting text from file:", error);
    throw new Error(
      `Failed to extract text from file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Creates a decision tree from a text description using AI
 * @param text - The lawsuit description text to convert into a decision tree
 * @returns Promise<Decision> - The generated decision tree structure
 */
export const createDecisionTreeFromText = memoize(async function (
  text: string,
): Promise<DecisionTree> {
  try {
    // Get the prompt template from markdown file and replace the placeholder
    const prompt = (promptTemplate as string).replace(
      "{{LAWSUIT_DESCRIPTION}}",
      text,
    );

    // Generate the decision tree using AI
    const result = await AIModel.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    // Extract JSON from the response (it might be wrapped in markdown code blocks)
    const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/) ||
      generatedText.match(/```\s*([\s\S]*?)\s*```/) || [null, generatedText];

    if (!jsonMatch[1]) {
      throw new Error("No JSON found in AI response");
    }

    const jsonText = jsonMatch[1].trim();

    // Parse the JSON response
    let decisionTree: DecisionTree;
    try {
      decisionTree = JSON.parse(jsonText);
      console.debug(
        "[evtree] Generated decision tree:",
        JSON.stringify(decisionTree, null, 2),
      );
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError}`);
    }

    // Sanity check that we have a proper decision tree structure
    if (
      !decisionTree.name ||
      !Array.isArray(decisionTree.nodes) ||
      !Array.isArray(decisionTree.edges)
    ) {
      throw new Error("Invalid decision tree structure returned by AI");
    }

    return decisionTree;
  } catch (error) {
    console.error("Error creating decision tree from text:", error);
    throw error;
  }
});
