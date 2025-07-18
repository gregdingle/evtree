"use client";

import { AppEdge, AppNode, useStore } from "@/hooks/use-store";
import { pickBy } from "es-toolkit";
import { values } from "es-toolkit/compat";

export default function RightSidePanel() {
  const { nodes, edges, onNodeDataUpdate, onEdgeDataUpdate } = useStore(
    (state) => ({
      nodes: values(
        pickBy(state.nodes, (node) => !!node.selected)
      ) as AppNode[],
      edges: values(
        pickBy(state.edges, (edge) => !!edge.selected)
      ) as AppEdge[],
      onNodeDataUpdate: state.onNodeDataUpdate,
      onEdgeDataUpdate: state.onEdgeDataUpdate,
    })
  );

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>
      <div className="">
        {nodes.length === 0 && edges.length === 0 ? (
          <p className="">Select a node or edge to view its properties</p>
        ) : (
          <div className="">
            {nodes.map((node) => (
              <div key={node.id} className="">
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
            {edges.map((edge) => (
              // TODO: why is edge data optional?
              <div key={edge.id} className="">
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

interface PropertyInputProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function PropertyInput({
  label,
  value,
  onChange,
  placeholder,
}: PropertyInputProps) {
  // TODO: how to do consistent global styles? use some tailwind component UI kit?
  return (
    <div className="mb-2 flex space-x-2 items-center">
      <label htmlFor={label} className="w-24">
        {label}
      </label>
      <input
        id={label}
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-2 p-1 rounded-md"
      />
    </div>
  );
}
