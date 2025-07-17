"use client";

import { useStore } from "@/hooks/use-store";

export default function RightSidePanel() {
  const { nodes, edges, onNodeDataUpdate, onEdgeDataUpdate } = useStore(
    (state) => ({
      ...state.selection,
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
                  defaultValue={node.data.label}
                  onChange={(value) =>
                    onNodeDataUpdate(node.id, { label: value })
                  }
                  placeholder="Enter node label"
                />
                <PropertyInput
                  label="Description"
                  defaultValue={node.data.description}
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
                  defaultValue={edge.data?.label}
                  onChange={(value) =>
                    onEdgeDataUpdate(edge.id, { label: value })
                  }
                  placeholder="Enter edge label"
                />
                <PropertyInput
                  label="Description"
                  defaultValue={edge.data?.description}
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
  defaultValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function PropertyInput({
  label,
  defaultValue,
  onChange,
  placeholder,
}: PropertyInputProps) {
  // TODO: how to do consistent global styles? use some tailwind component UI kit?
  return (
    // TODO: grid layout?
    <div className="mb-2 flex space-x-2 items-center">
      <label className="">{label}</label>
      <input
        type="text"
        defaultValue={defaultValue || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-1 p-1"
      />
    </div>
  );
}
