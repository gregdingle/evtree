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
      className="w-full h-[90vh] flex items-center justify-center pointer-events-none"
    >
      <div className="text-4xl text-gray-400 dark:text-gray-500">{text}</div>
    </div>
  );
}
