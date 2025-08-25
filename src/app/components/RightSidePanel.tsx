"use client";

import { keys } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
import {
  selectCurrentEdges,
  selectCurrentNodes,
  selectCurrentTree,
} from "@/lib/selectors";

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

  const { nodes, edges, currentTree } = useStore((state) => {
    return {
      nodes: selectCurrentNodes(state).filter((node) => node.selected),
      edges: selectCurrentEdges(state).filter((edge) => edge.selected),
      currentTree: selectCurrentTree(state),
    };
  });

  const variables = currentTree?.variables ?? {};
  const hasVariables = keys(variables).length > 0;
  const allNodes = currentTree?.nodes ?? {};

  return (
    <div className="w-80 p-4">
      <h2 className="mb-8 text-lg font-semibold">Properties</h2>
      <div className="">
        {nodes.length === 0 && edges.length === 0 ? (
          currentTree ? (
            <div className="mb-8">
              <h3 className="mb-4">Tree Properties</h3>
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
            {nodes.length ? <h3 className="mb-4">Node Properties</h3> : null}
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
                {/* TODO: deprecated... remove if not needed
                <PropertyInput
                  label="Label"
                  value={node.data.label}
                  onChange={(value) =>
                    onNodeDataUpdate(node.id, { label: value })
                  }
                  placeholder="Enter node label"
                /> */}
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
              </div>
            ))}
            {edges.length ? <h3 className="mb-4">Branch Properties</h3> : null}
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
                  disabled={allNodes[edge.source]?.type === "decision"}
                  // NOTE: for inlinining button
                  noWrapChildren={true}
                >
                  {allNodes[edge.source]?.type === "decision" ? null : (
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
                  )}
                </PropertyInput>
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
    </div>
  );
}
