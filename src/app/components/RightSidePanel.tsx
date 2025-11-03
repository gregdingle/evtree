"use client";

import { keys } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
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

  const variables = currentTree?.variables ?? {};
  const hasVariables = keys(variables).length > 0;
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
              <VariablesInput />
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
                      hasVariables ? "Enter value or formula" : "Enter value"
                    }
                  >
                    {hasVariables ? (
                      <VariablesList
                        variables={variables}
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
                      hasVariables ? "Enter cost or formula" : "Enter cost"
                    }
                  >
                    {hasVariables ? (
                      <VariablesList
                        variables={variables}
                        node={node}
                        className="my-1 ml-22"
                        exprFor="costExpr"
                      />
                    ) : null}
                  </PropertyInput>
                )}
                {showEVs && (
                  <div className="italic">
                    <PropertyInput
                      label="Expected Net Value"
                      value={formatValueLong(
                        netExpectedValues.nodeValues?.[node.id],
                      )}
                      disabled={true}
                      // TODO: add a subtle note when the node inherits costs from ancestor nodes?
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
                      // TODO: show this for terminal nodes only because the path probability
                      // is only shown for terminal nodes on the canvas?
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
                      hasVariables ? "Enter value or formula" : "Enter value"
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
                    {hasVariables ? (
                      <VariablesList
                        variables={variables}
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
