"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import CollapsiblePanel from "./components/CollapsiblePanel";
import { Histogram } from "./components/Histogram";
import LeftSidePanel from "./components/LeftSidePanel";
import ReactFlowApp from "./components/ReactFlowApp";
import RightSidePanel from "./components/RightSidePanel";
import Toolbar from "./components/Toolbar";

export default function Home() {
  // NOTE: Prevents hydration mismatch on server-side rendering caused by
  // Zustand loading from localStorage. See
  // https://nextjs.org/docs/messages/react-hydration-error#solution-1-using-useeffect-to-run-on-the-client-only
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const [showHistogram, setShowHistogram] = useState(false);

  if (!isClient) {
    // TODO: put some kind of loading spinner here?
    return null;
  }

  return (
    <ReactFlowProvider>
      <div className="evtree">
        <div className="flex h-screen flex-col">
          <div className="border-b">
            <Toolbar
              onHistogramClick={() =>
                showHistogram ? setShowHistogram(false) : setShowHistogram(true)
              }
            />
          </div>
          <div className="flex flex-1">
            <div className="border-r">
              <CollapsiblePanel side="left">
                <LeftSidePanel />
              </CollapsiblePanel>
            </div>
            <div
              // NOTE: #141414 copied from reactflow default dark mode
              className="flex-1 bg-amber-50 dark:bg-[#141414]"
            >
              {showHistogram ? (
                <Histogram className="px-16 py-4" />
              ) : (
                <ReactFlowApp />
              )}
            </div>
            <div className="border-l">
              <CollapsiblePanel side="right">
                <RightSidePanel />
              </CollapsiblePanel>
            </div>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
