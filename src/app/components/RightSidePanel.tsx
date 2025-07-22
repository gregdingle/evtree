"use client";

import { AppEdge, AppNode, useStore } from "@/hooks/use-store";
import { debounce } from "es-toolkit";
import { max, min, toInteger, toNumber } from "es-toolkit/compat";
import React, { useEffect, useRef, useState } from "react";
import { ToolbarButton } from "./ToolbarButton";

export default function RightSidePanel() {
  const {
    onNodeDataUpdate,
    onEdgeDataUpdate,
    onTreeDataUpdate,
    balanceEdgeProbability,
  } = useStore.getState();

  const { nodes, edges, currentTree } = useStore((state) => {
    return {
      nodes: state
        .getCurrentNodes()
        .filter((node) => node.selected) as AppNode[],
      edges: state
        .getCurrentEdges()
        .filter((edge) => edge.selected) as AppEdge[],
      currentTree: state.getCurrentTree(),
    };
  });

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus first input when selection changes
  useEffect(() => {
    if ((nodes.length > 0 || edges.length > 0) && firstInputRef.current) {
      // Only focus if no input is currently focused
      // TODO: is this good logic? what could go wrong?
      const activeElement = window.document.activeElement;
      const isInputFocused = activeElement && activeElement.tagName === "INPUT";

      if (!isInputFocused) {
        firstInputRef.current.focus();
      }
    }
  }, [nodes, edges]);

  return (
    <div className="p-4 w-80">
      <h2 className="text-lg font-semibold mb-8">Properties</h2>
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
                value={currentTree.description}
                onChange={(value) => onTreeDataUpdate({ description: value })}
                placeholder="Enter tree description"
              />
            </div>
          ) : (
            <p className="">No tree selected</p>
          )
        ) : (
          <div className="">
            {nodes.length ? <h3 className="mb-4">Node Properties</h3> : null}
            {nodes.map((node, index) => (
              <div key={node.id} className="mb-8">
                <PropertyInput
                  ref={index === 0 ? firstInputRef : undefined}
                  label="Value"
                  value={node.data.value?.toString()}
                  onChange={(value) =>
                    onNodeDataUpdate(node.id, { value: toInteger(value) })
                  }
                  placeholder="Enter node value"
                />
                <PropertyInput
                  label="Label"
                  value={node.data.label}
                  onChange={(value) =>
                    onNodeDataUpdate(node.id, { label: value })
                  }
                  placeholder="Enter node label"
                />
                <PropertyInput
                  label="Description"
                  value={node.data.description}
                  onChange={(value) =>
                    onNodeDataUpdate(node.id, { description: value })
                  }
                  placeholder="Enter node description"
                />
              </div>
            ))}
            {edges.length ? <h3 className="mb-4">Edge Properties</h3> : null}
            {edges.map((edge, index) => (
              // TODO: why is edge data optional?
              <div key={edge.id} className="mb-8">
                <PropertyInput
                  ref={
                    nodes.length === 0 && index === 0
                      ? firstInputRef
                      : undefined
                  }
                  type="number"
                  label="Probability"
                  value={edge.data?.probability?.toString()}
                  onChange={(value) => {
                    // TODO: should this min-max clamping be moved into domain logic somehow?
                    const probability =
                      value === undefined
                        ? undefined
                        : max([min([toNumber(value), 1.0]), 0.0]);
                    onEdgeDataUpdate(edge.id, { probability });
                  }}
                  placeholder="Enter edge probability"
                  max={1.0}
                  min={0.0}
                  step={0.1}
                >
                  {" "}
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
                </PropertyInput>
                <PropertyInput
                  label="Label"
                  value={edge.data?.label}
                  onChange={(value) =>
                    onEdgeDataUpdate(edge.id, { label: value })
                  }
                  placeholder="Enter edge label"
                />
                <PropertyInput
                  label="Description"
                  value={edge.data?.description}
                  onChange={(value) =>
                    onEdgeDataUpdate(edge.id, { description: value })
                  }
                  placeholder="Enter edge description"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PropertyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
}

const PropertyInput = React.forwardRef<HTMLInputElement, PropertyInputProps>(
  ({ label, value, onChange, children, ...props }, ref) => {
    const debouncedOnChange = debounce(onChange ?? (() => {}), 200);

    // Use a local state for immediate UI updates
    const [localValue, setLocalValue] = useState(value || "");

    // Update local value when prop value changes
    useEffect(() => {
      setLocalValue(value || "");
    }, [value]);

    const handleChange = (newValue: string) => {
      setLocalValue(newValue);
      debouncedOnChange(newValue);
    };

    // TODO: how to do consistent global styles? use some tailwind component UI kit?
    return (
      <div className="mb-2 flex space-x-2 items-center">
        <label htmlFor={label} className="w-24">
          {label}
        </label>
        <input
          ref={ref}
          id={label}
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full border-2 p-1 rounded-md"
          {...props}
        />
        {children}
      </div>
    );
  }
);

PropertyInput.displayName = "PropertyInput";
