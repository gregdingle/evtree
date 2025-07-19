"use client";

import { useStore } from "@/hooks/use-store";
import { values } from "es-toolkit/compat";

export default function RightSidePanel() {
  const { trees } = useStore((state) => ({
    trees: values(state.trees),
  }));
  return (
    <div className="p-4 w-80">
      <h2 className="text-lg font-semibold mb-8">Trees</h2>
      <div className="">
        {trees.length === 0 ? (
          <p className="">Create a tree to get started</p>
        ) : (
          <div className="">
            {trees.map((tree) => (
              <div key={tree.id} className="mb-8">
                {tree.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
