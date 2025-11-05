"use client";

import { toPairs } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
import { CURRENCIES, Currency } from "@/lib/Currency";
import {
  selectCurrentEdges,
  selectCurrentNodes,
  selectCurrentTree,
  selectNetExpectedValues,
  selectPathProbabilities,
  selectShowEVs,
} from "@/lib/selectors";
import { formatProbability, formatValueLong } from "@/utils/format";

import PropertyInput from "./PropertyInput";
import { ToolbarButton } from "./ToolbarButton";
import VariablesInput from "./VariablesInput";
import { VariablesList } from "./VariablesList";

export default function RightSidePanel() {
  const {
    onNodeDataUpdate,
    onEdgeDataUpdate,
    onTreeDataUpdate,
    balanceEdgeProbability,
  } = useStore.getState();

  const { nodes, edges, currentTree, showEVs } = useStore((state) => {
    return {
      nodes: selectCurrentNodes(state).filter(
        // HACK: filter out ghost nodes because they have no properties to edit
        (node) => node.selected && node.type !== "ghost",
      ),
      edges: selectCurrentEdges(state).filter(
        // HACK: filter out arrow edges because they have no properties to edit
        (edge) => edge.selected && edge.type !== "arrow",
      ),
      currentTree: selectCurrentTree(state),
      showEVs: selectShowEVs(state),
    };
  });
  const netExpectedValues = useStore(selectNetExpectedValues);
  const pathProbabilities = useStore((state) =>
    selectPathProbabilities(
      state,
      nodes.map((n) => n.id),
    ),
  );

  const variables = currentTree?.variables ?? [];
  const probabilityVariables = variables.filter(
    (v) => v.scope === "probability",
  );
  const valueVariables = variables.filter((v) => v.scope === "value");
  const costVariables = variables.filter((v) => v.scope === "cost");

  const allNodes = currentTree?.nodes ?? {};

  const titlePrefix =
    nodes.length + edges.length === 0
      ? "Tree"
      : nodes.length === 1
        ? "Node"
        : edges.length === 1
          ? "Edge"
          : ""; // multi

  return (
    // HACK: depends on Toolbar height also
    <div className="w-80 p-4 h-[calc(100vh-70px)] relative">
      <h2 className="mb-8 text-lg font-semibold">{titlePrefix} Properties</h2>
      <div className="">
        {nodes.length === 0 && edges.length === 0 ? (
          currentTree ? (
            <div className="mb-8">
              <PropertyInput
                label="Name"
                value={currentTree.name}
                onChange={(value) => onTreeDataUpdate({ name: value })}
                placeholder="Enter tree name"
              />
              <PropertyInput
                label="Description"
                textarea
                value={currentTree.description}
                onChange={(value) => onTreeDataUpdate({ description: value })}
                placeholder="Enter tree description"
              />
              <PropertyInput
                label="Currency"
                select
                value={currentTree.currency ?? CURRENCIES[""].code}
                onChange={(value) =>
                  onTreeDataUpdate({ currency: value as Currency })
                }
                options={toPairs(CURRENCIES).map(([code, data]) => ({
                  value: code,
                  label: `${data.symbol} ${data.code} - ${data.name}`,
                }))}
              />
              <VariablesInput scope="value" />
              <VariablesInput scope="cost" />
              <VariablesInput scope="probability" />
            </div>
          ) : (
            <p className="">No tree selected</p>
          )
        ) : (
          <div className="">
            {nodes.length > 1 ? (
              <h3 className="mb-4 font-semibold">Node Properties</h3>
            ) : null}
            {nodes.map((node) => (
              <div key={node.id} className="mb-8">
                {node.type === "terminal" ? (
                  <PropertyInput
                    label="Value"
                    value={node.data.valueExpr}
                    onChange={(value) => {
                      if (value === "") {
                        onNodeDataUpdate(node.id, { valueExpr: undefined });
                      } else {
                        onNodeDataUpdate(node.id, { valueExpr: value });
                      }
                    }}
                    placeholder={
                      valueVariables.length
                        ? "Enter value or formula"
                        : "Enter value"
                    }
                  >
                    {valueVariables.length ? (
                      <VariablesList
                        variables={valueVariables}
                        node={node}
                        exprFor="valueExpr"
                        className="my-1 ml-22"
                      />
                    ) : null}
                  </PropertyInput>
                ) : null}
                {node.type === "note" ? (
                  <PropertyInput
                    label="Description"
                    value={node.data.description}
                    onChange={(value) =>
                      onNodeDataUpdate(node.id, { description: value })
                    }
                    placeholder="Enter note content"
                    textarea={true}
                  />
                ) : (
                  /* TODO: deprecated... remove if not needed
                  <PropertyInput
                    label="Label"
                    value={node.data.label}
                    onChange={(value) =>
                      onNodeDataUpdate(node.id, { label: value })
                    }
                    placeholder="Enter node label"
                  /> */
                  <PropertyInput
                    label="Cost"
                    value={node.data.costExpr}
                    onChange={(value) => {
                      if (value === "") {
                        onNodeDataUpdate(node.id, { costExpr: undefined });
                      } else {
                        onNodeDataUpdate(node.id, { costExpr: value });
                      }
                    }}
                    placeholder={
                      costVariables.length
                        ? "Enter cost or formula"
                        : "Enter cost"
                    }
                  >
                    {costVariables.length ? (
                      <VariablesList
                        variables={costVariables}
                        node={node}
                        className="my-1 ml-22"
                        exprFor="costExpr"
                      />
                    ) : null}
                  </PropertyInput>
                )}
                {node.type == "terminal" &&
                netExpectedValues.nodeCumulativeCosts?.[node.id] ? (
                  <div className="italic">
                    <PropertyInput
                      label="Prior Costs"
                      value={formatValueLong(
                        netExpectedValues.nodeCumulativeCosts?.[node.id],
                      )}
                      disabled={true}
                    />
                  </div>
                ) : null}
                {showEVs && (
                  <div className="italic">
                    <PropertyInput
                      label={
                        // NOTE: special case terminal nodes because there is no
                        // "expected" calculation at leaves in the tree
                        node.type == "terminal"
                          ? "Net Value"
                          : "Expected Net Value"
                      }
                      value={formatValueLong(
                        netExpectedValues.nodeValues?.[node.id],
                      )}
                      disabled={true}
                    />
                    <PropertyInput
                      label="Path Probability"
                      value={formatProbability(
                        pathProbabilities[node.id],
                        1,
                        "???",
                        "",
                      )}
                      disabled={true}
                      // NOTE: terminal nodes also show path probability on the canvas
                    />
                  </div>
                )}
              </div>
            ))}
            {edges.length > 1 ? (
              <h3 className="mb-4 font-semibold">Branch Properties</h3>
            ) : null}
            {edges.map((edge) => (
              // TODO: why is edge data optional?
              <div key={edge.id} className="mb-8">
                <PropertyInput
                  label="Label"
                  value={edge.data?.label}
                  onChange={(value) =>
                    onEdgeDataUpdate(edge.id, { label: value })
                  }
                  placeholder="Enter branch label"
                />
                {allNodes[edge.source]?.type === "decision" ? (
                  <div className="italic">
                    <PropertyInput
                      type="text"
                      label="Probability"
                      // TODO: show actual probability... see
                      // selectComputedProbability... and move to bottom like
                      // other computed properties?
                      placeholder="See decision node"
                      disabled={true}
                    />
                  </div>
                ) : (
                  <PropertyInput
                    type="text"
                    label="Probability"
                    value={edge.data?.probabilityExpr ?? ""}
                    onChange={(value) => {
                      const probabilityExpr = value === "" ? undefined : value;
                      onEdgeDataUpdate(edge.id, { probabilityExpr });
                    }}
                    placeholder={
                      probabilityVariables.length
                        ? "Enter value or formula"
                        : "Enter value"
                    }
                    inlineButton={true}
                  >
                    <div className="flex-1/4">
                      <ToolbarButton
                        tooltip={
                          // TODO: How best to convey: Set the probability to (1 - sum(existing probabilities)) / count(undefined sibiling probabilities)
                          <span>
                            Set the probability
                            <br /> based on other
                            <br /> branches
                          </span>
                        }
                        onClick={() => balanceEdgeProbability(edge.id)}
                      >
                        balance
                      </ToolbarButton>
                    </div>
                    {probabilityVariables.length ? (
                      <VariablesList
                        variables={probabilityVariables}
                        edge={edge}
                        className="my-1 ml-22"
                        exprFor="probabilityExpr"
                      />
                    ) : null}
                  </PropertyInput>
                )}
                <PropertyInput
                  label="Description"
                  textarea
                  value={edge.data?.description}
                  onChange={(value) =>
                    onEdgeDataUpdate(edge.id, { description: value })
                  }
                  placeholder="Enter branch description"
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="absolute bottom-5 right-0 w-80 text-center text-sm">
        Feedback or questions?{" "}
        <a
          href="mailto:gregdingle@gmail.com?subject=EVTree"
          className="text-blue-700 dark:text-blue-400 hover:underline bold"
        >
          Email us
        </a>
      </footer>
    </div>
  );
}
