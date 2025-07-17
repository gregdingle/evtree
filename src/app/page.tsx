import ReactFlowApp from "./components/ReactFlowApp";
import RightSidePanel from "./components/RightSidePanel";
import Toolbar from "./components/Toolbar";

export default function Home() {
  // TODO: border styles, backgrounds, dark mode, etc
  return (
    <div className="">
      <div className="grid grid-cols-3 h-screen">
        <div className="col-span-3 border-b">
          <Toolbar />
        </div>
        <div className="col-span-2 bg-amber-50">
          <ReactFlowApp />
        </div>
        <div className="col-span-1 border-l">
          <RightSidePanel />
        </div>
      </div>
    </div>
  );
}
