import { toPairs } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
import { AppEdge } from "@/lib/edge";
import { AppNode } from "@/lib/node";

interface VariablesListProps extends React.HTMLAttributes<HTMLDetailsElement> {
  variables: Record<string, number>;
  node?: AppNode;
  edge?: AppEdge;
  exprFor: "costExpr" | "valueExpr" | "probabilityExpr";
}

/**
 * See VariablesInput for the complementing component that allows editing
 */
export function VariablesList({
  variables,
  node,
  edge,
  exprFor,
  ...props
}: VariablesListProps) {
  const { onNodeDataUpdate, onEdgeDataUpdate } = useStore.getState();

  if (!node && !edge) {
    throw new Error("VariablesList requires either node or edge prop");
  }

  const currentExpr = node
    ? (node.data[exprFor as "costExpr" | "valueExpr"] ?? "")
    : (edge?.data?.[exprFor as "probabilityExpr"] ?? "");

  const id = node ? node.id : (edge?.id ?? "");

  return (
    <details {...props}>
      <summary className="cursor-pointer select-none">variables</summary>
      <ul>
        {toPairs(variables).map(([key, value]) => {
          return (
            <li key={key}>
              <input
                type="checkbox"
                id={`variable-${key}-${id}-${exprFor}`}
                className="mr-1"
                checked={isVariableInExpr(currentExpr, key)}
                onChange={(e) => {
                  const newExpr = getNewExpr(
                    e.target.checked,
                    currentExpr,
                    key,
                  );
                  if (node) {
                    if (newExpr === "") {
                      onNodeDataUpdate(node.id, {
                        [exprFor]: undefined,
                      });
                    } else {
                      onNodeDataUpdate(node.id, {
                        [exprFor]: newExpr,
                      });
                    }
                  } else if (edge) {
                    if (newExpr === "") {
                      onEdgeDataUpdate(edge.id, {
                        [exprFor]: undefined,
                      });
                    } else {
                      onEdgeDataUpdate(edge.id, {
                        [exprFor]: newExpr,
                      });
                    }
                  }
                }}
              />
              <label
                htmlFor={`variable-${key}-${id}-${exprFor}`}
                className="cursor-pointer text-sm select-none"
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
