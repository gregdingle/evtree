"use client";

// TODO: why is ArrowMarker not showing on image export???
export function ArrowMarker() {
  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      }}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          // NOTE: There is a trade-off in refX where too low makes the arrow
          // point too far from the cursor, and too high makes the arrow overlap the edge
          refX="7"
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
          refX="7"
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
