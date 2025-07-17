"use client";

import { useStore } from "@/hooks/use-store";

export default function RightSidePanel() {
  // TODO: selection
  const { nodes, edges } = useStore((state) => state.selection);

  return (
    <div className="w-48 p-4">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>
      <div className="">
        {nodes.length === 0 && edges.length === 0 ? (
          <p className="">Select a node or edge to view its properties</p>
        ) : (
          <div>
            {nodes.map((node) => (
              <div key={node.id}>
                <h3 className="">{node.data.label}</h3>
                <p className="">{node.data.description}</p>
              </div>
            ))}
            {edges.map((edge) => (
              // TODO: why is edge data optional?
              <div key={edge.id}>
                <h3 className="">{edge.data?.label}</h3>
                <p className="">{edge.data?.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
