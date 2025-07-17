import ReactFlowApp from "./components/ReactFlowApp";
import RightSidePanel from "./components/RightSidePanel";
import Toolbar from "./components/Toolbar";

export default function Home() {
  // TODO: border styles, backgrounds, dark mode, etc
  return (
    <div className="">
      <div className="grid grid-cols-3 grid-rows-12 h-screen">
        {/* // TODO: fix min height on resize vertical */}
        <div className="col-span-3 row-span-1 border-b">
          <Toolbar />
        </div>
        <div className="col-span-2 row-span-11 bg-amber-50">
          <ReactFlowApp />
        </div>
        <div className="col-span-1 row-span-11 border-l">
          <RightSidePanel />
        </div>
      </div>
    </div>
  );
}
