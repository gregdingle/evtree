import { fromPairs } from "es-toolkit/compat";

export interface Variable {
  name: string;
  value: number;
  scope: "value" | "cost" | "probability";
}

export function variablesToRecord(
  variables: Variable[] | undefined,
  scope: Variable["scope"],
): Record<string, number> {
  if (!variables) return {};
  return fromPairs(
    variables.filter((v) => v.scope === scope).map((v) => [v.name, v.value]),
  );
}

// TODO: add unit tests
export function getNewExpr(checked: boolean, currentExpr: string, key: string) {
  let newExpr = currentExpr;

  if (checked) {
    // Add variable to expression
    if (newExpr.trim() === "") {
      newExpr = key;
    } else {
      newExpr = `${newExpr} + ${key}`;
    }
  } else {
    // TODO: use expr-eval for proper parsing and removal... maybe set key to zero (or 1) then simplify?
    // Remove variable from expression
    // Handle various patterns: "key", " + key", "key + ", " + key + "
    const ops = "[+-/\\*]"; // Operators to consider
    newExpr = newExpr
      .replace(new RegExp(`\\s*${ops}\\s*${key}\\b`, "g"), "")
      .replace(new RegExp(`\\b${key}\\s*${ops}\\s*`, "g"), "")
      .replace(new RegExp(`^${key}$`, "g"), "")
      .trim();

    // Clean up any leading/trailing operators
    newExpr = newExpr.replace(/^\+\s*/, "").replace(/\s*\+$/, "");
  }

  return newExpr;
}

// TODO: add unit tests
export function isVariableInExpr(currentExpr: string, key: string) {
  return currentExpr.search(new RegExp(`\\b${key}\\b`)) !== -1;
}
