import ReactFlowApp from "./components/ReactFlowApp";
import RightSidePanel from "./components/RightSidePanel";
import Toolbar from "./components/Toolbar";

export default function Home() {
  return (
    <div className="">
      <div className="grid grid-cols-3 h-screen">
        <div className="col-span-3">
          <Toolbar />
        </div>
        <div className="col-span-2 bg-amber-50">
          <ReactFlowApp />
        </div>
        <div className="col-span-1">
          <RightSidePanel />
        </div>
      </div>
    </div>
  );
}
