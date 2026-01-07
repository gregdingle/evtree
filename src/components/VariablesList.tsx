import { useStore } from "@/hooks/use-store";
import { AppEdge } from "@/lib/edge";
import { AppNode } from "@/lib/node";
import { Variable, getNewExpr, isVariableInExpr } from "@/lib/variable";

interface VariablesListProps extends React.HTMLAttributes<HTMLDetailsElement> {
  variables: Variable[];
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
        {variables.map((variable) => {
          const { name: key, value } = variable;
          return (
            <li key={key}>
              <input
                type="checkbox"
                id={`variable-${key}-${id}-${exprFor}`}
                className="mr-1"
                checked={isVariableInExpr(currentExpr, key)}
                onInput={(e) => {
                  const newExpr = getNewExpr(
                    e.currentTarget.checked,
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
