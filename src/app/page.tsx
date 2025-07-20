"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import CollapsiblePanel from "./components/CollapsiblePanel";
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
  if (!isClient) {
    // TODO: put some kind of loading spinner here?
    return null;
  }

  // TODO: border styles, backgrounds, dark mode, etc
  return (
    <ReactFlowProvider>
      <div
        className="evtree"
        // NOTE: Zustand will load the state from localStorage client-side,
        // resulting in a NextJS hydration mismatch warning, but we want the
        // client-side to be different. See
        // https://zustand.docs.pmnd.rs/guides/ssr-and-hydration and
        // https://medium.com/@koalamango/fix-next-js-hydration-error-with-zustand-state-management-0ce51a0176ad.
        suppressHydrationWarning
      >
        <div className="flex flex-col h-screen">
          {/* // TODO: fix min height on resize vertical */}
          <div className="border-b">
            <Toolbar />
          </div>
          <div className="flex flex-1">
            <div className="border-r">
              <CollapsiblePanel side="left">
                <LeftSidePanel />
              </CollapsiblePanel>
            </div>
            <div className="flex-1 bg-amber-50">
              <ReactFlowApp />
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
