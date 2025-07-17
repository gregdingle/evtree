"use client";

import { useStore } from "@/hooks/use-store";
import Image from "next/image";

export default function Toolbar() {
  // TODO: hook up to keyboard shortcuts
  const { undo, redo } = useStore.temporal.getState();

  return (
    <div className="p-4">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1">
          <Image
            src="/favicon.svg"
            alt="EVTree logo"
            width={24}
            height={24}
            className="dark:invert"
          />
          <h2 className="text-lg font-semibold">EVTree</h2>
        </div>
        <div className="flex justify-start space-x-2">
          <button onClick={() => undo()}>undo</button>
          <button onClick={() => redo()}>redo</button>
        </div>
      </div>
    </div>
  );
}
