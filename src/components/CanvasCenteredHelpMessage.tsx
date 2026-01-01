"use client";

import { ReactNode } from "react";

export function CanvasCenteredHelpMessage({
  text,
  absolute,
}: {
  text: string;
  absolute?: boolean;
}): ReactNode {
  return (
    <div
      // NOTE: this page-centered message copied from 'Empty canvas help text' in ReactFlowApp
      className={`pointer-events-none ${absolute ? "absolute inset-0 z-10" : ""} flex h-[90vh] w-full items-center justify-center text-center whitespace-pre-wrap`}
    >
      <div className="text-4xl leading-tight text-gray-400 dark:text-gray-500">
        {text}
      </div>
    </div>
  );
}
