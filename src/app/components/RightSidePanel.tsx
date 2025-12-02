"use client";

import { upperFirst } from "es-toolkit";
import { keys, toPairs, values } from "es-toolkit/compat";

import { useStore } from "@/hooks/use-store";
import { CURRENCIES, CurrencyCode } from "@/lib/Currency";
import { AppEdge } from "@/lib/edge";
import { safeEvalExpr } from "@/lib/expectedValue";
import { AppNode } from "@/lib/node";
import { ROUNDING, RoundingCode } from "@/lib/rounding";
import {
  selectCurrentTree,
  selectNetExpectedValues,
  selectPathProbabilities,
  selectShowEVs,
} from "@/lib/selectors";
import { DecisionTree, DecisionTreeSimpleProperties } from "@/lib/tree";
import { Variable, variablesToRecord } from "@/lib/variable";
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

  const currentTree = useStore(selectCurrentTree);
  const showEVs = useStore(selectShowEVs);
  const allNodes = currentTree?.nodes ?? {};
  const nodes = values(allNodes).filter(
    // HACK: filter out ghost nodes because they have no properties to edit
    (node) => node.selected && node.type !== "ghost",
  );
  const allEdges = values(currentTree?.edges);
  const edges = allEdges.filter(
    // HACK: filter out arrow edges because they have no properties to edit
    (edge) => edge.selected && edge.type !== "arrow",
  );
  const rootNodes = values(allNodes).filter((node) => {
    // A root node has no incoming edges
    // TODO: extract to global findRootNodes function?
    return (
      !allEdges.some((edge) => edge.target === node.id) &&
      node.type !== "note" &&
      node.type !== "ghost"
    );
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

  const titlePrefix =
    nodes.length + edges.length === 0
      ? "Tree"
      : nodes.length === 1
        ? `${upperFirst(nodes[0]!.type)} ${nodes[0]!.type == "note" ? "" : "Node"}`
        : edges.length === 1
          ? "Branch"
          : ""; // multi

  return (
    // HACK: depends on Toolbar height also
    <div className="w-80 p-4 h-[calc(100vh-70px)] relative">
      <h2 className="mb-8 text-lg font-semibold">{titlePrefix} Properties</h2>
      <div className="">
        {nodes.length === 0 && edges.length === 0 ? (
          <TreeProperties
            currentTree={currentTree}
            onTreeDataUpdate={onTreeDataUpdate}
          />
        ) : (
          <div className="">
            {nodes.length > 1 ? (
              <h3 className="mb-4 font-semibold">Node Properties</h3>
            ) : null}
            {nodes.map((node) => {
              const cumulativeCosts =
                netExpectedValues.nodeCumulativeCosts?.[node.id];
              const netExpectedValue = netExpectedValues.nodeValues?.[node.id];
              const pathProbability = pathProbabilities[node.id];
              const isRootNode = Boolean(
                rootNodes.find((root) => root.id == node.id),
              );
              return (
                <NodeProperties
                  key={node.id}
                  node={node}
                  onNodeDataUpdate={onNodeDataUpdate}
                  valueVariables={valueVariables}
                  costVariables={costVariables}
                  cumulativeCosts={cumulativeCosts}
                  showEVs={showEVs}
                  netExpectedValue={netExpectedValue}
                  pathProbability={pathProbability}
                  isRootNode={isRootNode}
                />
              );
            })}
            {edges.length > 1 ? (
              <h3 className="mb-4 font-semibold">Branch Properties</h3>
            ) : null}
            {edges.map((edge) => {
              const hasDecisionNodeParent =
                allNodes[edge.source]?.type === "decision";
              return (
                <EdgeProperties
                  key={edge.id}
                  edge={edge}
                  onEdgeDataUpdate={onEdgeDataUpdate}
                  hasDecisionNodeParent={hasDecisionNodeParent}
                  probabilityVariables={probabilityVariables}
                  balanceEdgeProbability={balanceEdgeProbability}
                />
              );
            })}
          </div>
        )}
      </div>
      <footer className="absolute bottom-5 right-0 w-80 text-center text-sm">
        Feedback or questions?{" "}
        <a
          // TODO: extract contact email to global config
          href="mailto:gregdingle@gmail.com?subject=TreeDecisions"
          className="text-blue-700 dark:text-blue-400 hover:underline bold"
        >
          Email us
        </a>
      </footer>
    </div>
  );
}

function EdgeProperties({
  edge,
  onEdgeDataUpdate,
  hasDecisionNodeParent,
  probabilityVariables,
  balanceEdgeProbability,
}: {
  edge: AppEdge;
  onEdgeDataUpdate: (id: string, edgeData: Partial<AppEdge["data"]>) => void;
  hasDecisionNodeParent: boolean;
  probabilityVariables: Variable[];
  balanceEdgeProbability: (id: string) => void;
}) {
  return (
    <div className="mb-8">
      <PropertyInput
        label="Label"
        value={edge.data?.label}
        onChange={(value) => onEdgeDataUpdate(edge.id, { label: value })}
        placeholder="Enter branch label"
      />
      {hasDecisionNodeParent ? (
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
              className="my-1 pl-22"
              exprFor="probabilityExpr"
            />
          ) : null}
        </PropertyInput>
      )}
      <PropertyInput
        label="Description"
        optional
        textarea
        value={edge.data?.description}
        onChange={(value) => onEdgeDataUpdate(edge.id, { description: value })}
        placeholder="Enter branch description"
      />
    </div>
  );
}

function NodeProperties({
  node,
  onNodeDataUpdate,
  valueVariables,
  costVariables,
  cumulativeCosts,
  showEVs,
  netExpectedValue,
  pathProbability,
  isRootNode,
}: {
  node: AppNode;
  onNodeDataUpdate: (id: string, nodeData: Partial<AppNode["data"]>) => void;
  valueVariables: Variable[];
  costVariables: Variable[];
  cumulativeCosts: number | null | undefined;
  showEVs: boolean;
  netExpectedValue: number | null | undefined;
  pathProbability: number | null | undefined;
  isRootNode: boolean;
}) {
  const totalCosts =
    (cumulativeCosts ?? 0) +
    safeEvalExpr(
      node.data.costExpr,
      variablesToRecord(costVariables, "cost"),
      0,
    );
  return (
    <div className="mb-8">
      {node.type === "terminal" ? (
        <PropertyInput
          label="Outcome Value"
          value={node.data.valueExpr}
          info={`The award, payoff, or payment \nassociated with this endpoint of the \ndecision tree`}
          onChange={(value) => {
            if (value === "") {
              onNodeDataUpdate(node.id, { valueExpr: undefined });
            } else {
              onNodeDataUpdate(node.id, { valueExpr: value });
            }
          }}
          placeholder={
            valueVariables.length ? "Enter value or formula" : "Enter value"
          }
        >
          {valueVariables.length ? (
            <VariablesList
              variables={valueVariables}
              node={node}
              exprFor="valueExpr"
              className="my-1 pl-22"
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
          info={`Assigns a cost to this node${node.type == "terminal" ? "" : "\nthat is subtracted from the \nexpected values of the node \nand downstream nodes"}`}
          optional
          value={node.data.costExpr}
          onChange={(value) => {
            if (value === "") {
              onNodeDataUpdate(node.id, { costExpr: undefined });
            } else {
              onNodeDataUpdate(node.id, { costExpr: value });
            }
          }}
          placeholder={
            costVariables.length ? "Enter cost or formula" : "Enter cost"
          }
          textarea={costVariables.length > 0}
        >
          {costVariables.length ? (
            <VariablesList
              variables={costVariables}
              node={node}
              className="my-1 pl-1 basis-full"
              exprFor="costExpr"
            />
          ) : null}
        </PropertyInput>
      )}
      {node.type == "terminal" && (
        <div className="italic">
          {cumulativeCosts ? (
            <PropertyInput
              label="Prior Costs"
              info={`The sum of all costs on \nthe path up to this node`}
              value={formatValueLong(cumulativeCosts)}
              disabled={true}
            />
          ) : null}
          {totalCosts ? (
            <>
              <PropertyInput
                label="Total Costs"
                info={`The cost of this node \nplus all prior costs`}
                value={formatValueLong(totalCosts)}
                disabled={true}
              />
              <PropertyInput
                // NOTE: special case terminal nodes because there is no
                // "expected" calculation at leaves in the tree
                label="Net Value"
                info={`The value of this node \nafter subtracting all costs`}
                value={formatValueLong(netExpectedValue)}
                disabled={true}
              />
            </>
          ) : null}
        </div>
      )}
      {showEVs && node.type !== "note" && (
        <div className="italic">
          {
            // NOTE: special case terminal nodes because there is no
            // "expected" calculation at leaves in the tree
            node.type !== "terminal" && (
              <PropertyInput
                label={totalCosts ? "Expected Net Value" : "Expected Value"}
                info={`The expected value of this node \nconsidering all downstream outcomes \nand probabilities${totalCosts ? ", net of any costs" : ""}`}
                value={formatValueLong(netExpectedValue)}
                disabled={true}
              />
            )
          }
          {
            // NOTE: path probability would always be 100% for root node
            isRootNode ? null : (
              <PropertyInput
                label="Path Probability"
                info={`The probability that this node \nwill be reached starting from \nthe root node of the tree`}
                value={formatProbability(pathProbability, 1, "???", "")}
                disabled={true}
              />
            )
          }
        </div>
      )}
    </div>
  );
}

function TreeProperties({
  currentTree,
  onTreeDataUpdate,
}: {
  currentTree: DecisionTree | undefined;
  onTreeDataUpdate: (treeData: DecisionTreeSimpleProperties) => void;
}) {
  return currentTree ? (
    <div className="mb-8">
      <PropertyInput
        label="Name"
        value={currentTree.name}
        onChange={(value) => onTreeDataUpdate({ name: value })}
        placeholder="Enter tree name"
      />
      <PropertyInput
        label="Description"
        optional
        textarea
        value={currentTree.description}
        onChange={(value) => onTreeDataUpdate({ description: value })}
        placeholder="Enter tree description"
      />
      <PropertyInput
        label="Currency"
        info={`Determines the symbol that will \nbe used to label amounts`}
        select
        value={currentTree.currency ?? CURRENCIES[""].code}
        onChange={(value) =>
          onTreeDataUpdate({ currency: value as CurrencyCode })
        }
        options={toPairs(CURRENCIES).map(([code, data]) => ({
          value: code,
          label: `${data.symbol} ${data.code} - ${data.name}`,
        }))}
      />
      {/* TODO: have a 'probabilities' setting for formating as decimal or percentage */}
      <PropertyInput
        label="Rounding"
        info={`Determines how amounts will be \nrounded for display on the tree`}
        select
        value={currentTree.rounding ?? ROUNDING[""].code}
        onChange={(value) =>
          onTreeDataUpdate({ rounding: value as RoundingCode })
        }
        options={toPairs(ROUNDING).map(([code, data]) => ({
          value: code,
          label: `${data.name} ${data.scale ? " → " + keys(data.scale).join(", ") : ""}`,
        }))}
      />
      <VariablesInput
        scope="value"
        // TODO: add 'See docs for more info on forumlas' when docs are done
        info={`Creates variables that may be \nused in formulas for outcome values`}
      />
      <VariablesInput
        scope="cost"
        info={`Creates variables that may be \nused in formulas for node costs`}
      />
      <VariablesInput
        scope="probability"
        info={`Creates variables that may be \nused in formulas for branch \nprobabilities`}
      />
    </div>
  ) : (
    <p className="">No tree selected</p>
  );
}
