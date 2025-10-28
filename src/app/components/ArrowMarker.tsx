"use client";
export function ArrowMarker() {
  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0 }}>
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-gray-400" />
        </marker>
        <marker
          id="arrow-selected"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-blue-500/50" />
        </marker>
      </defs>
    </svg>
  );
}
