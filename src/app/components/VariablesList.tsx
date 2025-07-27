import { AppNode, useStore } from "@/hooks/use-store";
import { toPairs } from "es-toolkit/compat";

interface VariablesListProps extends React.HTMLAttributes<HTMLDetailsElement> {
  variables: Record<string, number>;
  node: AppNode;
  exprFor: "costExpr" | "valueExpr";
}

export function VariablesList({
  variables,
  node,
  exprFor,
  ...props
}: VariablesListProps) {
  const { onNodeDataUpdate } = useStore.getState();
  const currentExpr = node.data[exprFor] ?? "";
  return (
    <details {...props}>
      <summary className="cursor-pointer">variables</summary>
      <ul>
        {toPairs(variables).map(([key, value]) => {
          return (
            <li key={key}>
              <input
                type="checkbox"
                id={`variable-${key}-${node.id}-${exprFor}`}
                className="mr-1"
                checked={isVariableInExpr(currentExpr, key)}
                onChange={(e) => {
                  const newExpr = getNewExpr(
                    e.target.checked,
                    currentExpr,
                    key
                  );
                  if (newExpr === "") {
                    onNodeDataUpdate(node.id, {
                      [exprFor]: undefined,
                    });
                  } else {
                    onNodeDataUpdate(node.id, {
                      [exprFor]: newExpr,
                    });
                  }
                }}
              />
              <label
                htmlFor={`variable-${key}-${node.id}-${exprFor}`}
                className="text-sm cursor-pointer"
              >
                {key} = {value}
              </label>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

// TODO: move to utils and add unit tests
const getNewExpr = (checked: boolean, currentExpr: string, key: string) => {
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
};

// TODO: move to utils and add unit tests
const isVariableInExpr = (currentExpr: string, key: string) =>
  currentExpr.search(new RegExp(`\\b${key}\\b`)) !== -1;
