import type { DecisionTree } from "@/hooks/use-store";

/**
 * Validates and loads tree data from a JSON object
 */
function validateTreeData(data: unknown): DecisionTree | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const treeData = data as unknown as DecisionTree;

  // Sanity check required fields
  if (
    typeof treeData.name !== "string" ||
    !treeData.name ||
    typeof treeData.nodes !== "object" ||
    !treeData.nodes ||
    typeof treeData.edges !== "object" ||
    !treeData.edges
  ) {
    return null;
  }

  return treeData;
}

/**
 * Opens a file dialog and loads a tree from a JSON file
 */
export function openTreeFile(): Promise<DecisionTree | null> {
  return new Promise((resolve) => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const validatedTree = validateTreeData(data);

        if (!validatedTree) {
          console.error("[EVTree] Invalid tree file format");
          resolve(null);
          return;
        }

        resolve(validatedTree);
      } catch (error) {
        console.error("[EVTree] Failed to parse tree file:", error);
        resolve(null);
      }
    };

    input.oncancel = () => resolve(null);

    // Trigger file dialog
    input.click();
  });
}
