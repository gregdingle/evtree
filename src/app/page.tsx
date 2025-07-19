import { ReactFlowProvider } from "@xyflow/react";
import CollapsiblePanel from "./components/CollapsiblePanel";
import LeftSidePanel from "./components/LeftSidePanel";
import ReactFlowApp from "./components/ReactFlowApp";
import RightSidePanel from "./components/RightSidePanel";
import Toolbar from "./components/Toolbar";

export default function Home() {
  // TODO: border styles, backgrounds, dark mode, etc
  return (
    <ReactFlowProvider>
      <div className="">
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
