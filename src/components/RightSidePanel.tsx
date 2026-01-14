"use client";

import { upperFirst } from "es-toolkit";
import { values } from "es-toolkit/compat";

import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useStore } from "@/hooks/use-store";
import { AppEdge } from "@/lib/edge";
import { safeEvalExpr } from "@/lib/expectedValue";
import { AppNode } from "@/lib/node";
import {
  selectCurrentTree,
  selectNetExpectedValues,
  selectPathProbabilities,
  selectShowEVs,
} from "@/lib/selectors";
import { Variable, variablesToRecord } from "@/lib/variable";
import { formatProbability, formatValueLong } from "@/utils/format";

import { PropertyInput } from "./PropertyInput";
import { ToolbarButton } from "./ToolbarButton";
import { TreeProperties } from "./TreeProperties";
import { VariablesList } from "./VariablesList";

export function RightSidePanel() {
  const {
    updateNodeData,
    updateEdgeData,
    updateTreeData,
    updateNoteProperties,
    balanceEdgeProbability,
  } = useStore.getState();

  const currentTree = useStore(selectCurrentTree);
  // NOTE: Responsive design! No toolbar for below medium size screens, so always showEVs
  const isMediumScreenSizeOrLarger = useBreakpoint("md");
  const showEVs = useStore(selectShowEVs) || !isMediumScreenSizeOrLarger;
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
    <div className="relative h-[calc(100vh-70px)] w-80 p-4">
      <h2 className="mb-8 text-lg font-semibold select-none">
        {titlePrefix} Properties
      </h2>
      <div className="">
        {nodes.length === 0 && edges.length === 0 ? (
          <TreeProperties
            currentTree={currentTree}
            updateTreeData={updateTreeData}
          />
        ) : (
          <div className="">
            {nodes.length > 1 ? (
              <h3 className="mb-4 font-semibold select-none">
                Node Properties
              </h3>
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
                  updateNodeData={updateNodeData}
                  updateNoteProperties={updateNoteProperties}
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
                  updateEdgeData={updateEdgeData}
                  hasDecisionNodeParent={hasDecisionNodeParent}
                  probabilityVariables={probabilityVariables}
                  balanceEdgeProbability={balanceEdgeProbability}
                />
              );
            })}
          </div>
        )}
      </div>
      <footer
        // HACK: only show when at least 800px height to avoid overlapping with other content
        // NOTE: see also message on ReactFlowApp canvas when less than 800px height
        className="absolute right-0 bottom-5 hidden w-80 text-center text-sm select-none [@media(min-height:800px)]:block"
      >
        Feedback or questions?{" "}
        <a
          // TODO: extract contact email to global config
          href="mailto:gregdingle@gmail.com,maaron@just-decisions.com?subject=TreeDecisions"
          className="bluelink font-semibold"
        >
          Email us
        </a>
      </footer>
    </div>
  );
}

function EdgeProperties({
  edge,
  updateEdgeData,
  hasDecisionNodeParent,
  probabilityVariables,
  balanceEdgeProbability,
}: {
  edge: AppEdge;
  updateEdgeData: (id: string, edgeData: Partial<AppEdge["data"]>) => void;
  hasDecisionNodeParent: boolean;
  probabilityVariables: Variable[];
  balanceEdgeProbability: (id: string) => void;
}) {
  return (
    <div className="mb-8">
      <PropertyInput
        label="Label"
        value={edge.data?.label}
        onChange={(value) => updateEdgeData(edge.id, { label: value })}
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
            updateEdgeData(edge.id, { probabilityExpr });
          }}
          placeholder={
            // TODO: also make the prob input a textarea if there are many prob vars?
            probabilityVariables.length
              ? "Enter value or formula"
              : "Enter value"
          }
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
              onButtonClick={() => balanceEdgeProbability(edge.id)}
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
      <hr className="my-6 border-gray-500" />
      <PropertyInput
        label="Description"
        optional
        textarea
        value={edge.data?.description}
        onChange={(value) => updateEdgeData(edge.id, { description: value })}
        placeholder="Enter branch description"
      />
    </div>
  );
}

function NodeProperties({
  node,
  updateNodeData,
  updateNoteProperties,
  valueVariables,
  costVariables,
  cumulativeCosts,
  showEVs,
  netExpectedValue,
  pathProbability,
  isRootNode,
}: {
  node: AppNode;
  updateNodeData: (id: string, nodeData: Partial<AppNode["data"]>) => void;
  updateNoteProperties: (
    id: string,
    properties: Pick<AppNode, "width" | "height">,
  ) => void;
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
          // TODO: should we prefix the input with the currency symbol here? or is it better implied?
          label="Outcome Value"
          value={node.data.valueExpr}
          info={`The award, payoff, or payment \nobligation at this end point`}
          onChange={(value) => {
            if (value === "") {
              updateNodeData(node.id, { valueExpr: undefined });
            } else {
              updateNodeData(node.id, { valueExpr: value });
            }
          }}
          placeholder={
            valueVariables.length ? "Enter value or formula" : "Enter value"
          }
          textarea={valueVariables.length > 0}
        >
          {valueVariables.length ? (
            <VariablesList
              variables={valueVariables}
              node={node}
              exprFor="valueExpr"
              className="my-1 basis-full pl-1"
            />
          ) : null}
        </PropertyInput>
      ) : null}
      {node.type === "note" ? (
        <>
          <PropertyInput
            label="Description"
            value={node.data.description}
            onChange={(value) =>
              updateNodeData(node.id, { description: value })
            }
            placeholder="Enter note content"
            textarea={true}
          />
          <PropertyInput
            label="Width"
            value={node.width?.toString() || ""}
            onChange={(value) => {
              if (!value) {
                updateNoteProperties(node.id, { width: undefined });
                return;
              }
              const width = Number(value);
              if (Number.isFinite(width)) {
                updateNoteProperties(node.id, { width });
                return;
              }
            }}
            placeholder={node.measured?.width?.toString() || "Enter width"}
            type="number" // just for stepper
            step={10}
          />
        </>
      ) : (
        <>
          <PropertyInput
            label="Cost"
            info={`Assigns a cost to this node${
              node.type == "terminal"
                ? " that is \nsubtracted from its outcome value"
                : " that is \nsubtracted from all outcome \nvalues downstream of this node"
            }`}
            optional
            value={node.data.costExpr}
            onChange={(value) => {
              if (value === "") {
                updateNodeData(node.id, { costExpr: undefined });
              } else {
                updateNodeData(node.id, { costExpr: value });
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
                className="my-1 basis-full pl-1"
                exprFor="costExpr"
              />
            ) : null}
          </PropertyInput>
          {node.type !== "terminal" && (
            <div className="-mt-2 mb-4 text-sm italic">
              {/* TODO: better as "before the start of this subtree"? */}
              Note: Ignore costs that occur before the start of the tree. Those
              are sunk costs.
            </div>
          )}
        </>
      )}
      {node.type == "terminal" && (
        <div className="italic">
          {/* TODO: should we revert back to showing these costs conditionally? */}
          <PropertyInput
            // NOTE: also considered the label "Prior Costs"
            label="Path Costs"
            info={`The sum of all costs on \nthe path up to this node`}
            value={formatValueLong(cumulativeCosts)}
            disabled={true}
          />
          {/* TODO: should we revert back to showing these costs conditional on nonzero totalCosts? */}
          <PropertyInput
            label="Total Costs"
            info={`The cost of this node \nplus its path costs`}
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
                label={`Path\nProbability`}
                info={`The probability that this node \nwill be reached starting from \nthe root node of the tree`}
                value={formatProbability(pathProbability, 1, "???", "")}
                disabled={true}
              />
            )
          }
        </div>
      )}
      {(node.type === "decision" || node.type === "chance") && (
        <>
          {" "}
          <hr className="my-6 border-gray-500" />
          <PropertyInput
            label="Description"
            optional
            value={node.data.description}
            onChange={(value) =>
              updateNodeData(node.id, { description: value })
            }
            placeholder="Enter description"
            textarea={true}
          />
        </>
      )}
    </div>
  );
}
