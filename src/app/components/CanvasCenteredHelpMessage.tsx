"use client";

import { ReactNode } from "react";

export function CanvasCenteredHelpMessage({
  text,
}: {
  text: string;
}): ReactNode {
  return (
    <div
      // NOTE: this page-centered message copied from 'Empty canvas help text' in ReactFlowApp
      className="pointer-events-none flex h-[90vh] w-full items-center justify-center text-center whitespace-pre-wrap"
    >
      <div className="text-4xl leading-tight text-gray-400 dark:text-gray-500">
        {text}
      </div>
    </div>
  );
}
