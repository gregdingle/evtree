import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { NodeBase } from "@xyflow/system";
import { toPng } from "html-to-image";

// NOTE: see https://reactflow.dev/examples/misc/download-image
export const downloadPNG = (nodes: NodeBase[], filename: string) => {
  // TODO: optimize image size, zoom and quality
  const imageWidth = 1024 / 4;
  const imageHeight = 768 / 4;
  // we calculate a transform for the nodes so that all nodes are visible
  // we then overwrite the transform of the `.react-flow__viewport` element
  // with the style option of the html-to-image library
  const nodesBounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.5,
    2,
    2
  );

  const viewportElem = window.document.querySelector(".react-flow__viewport");
  if (!viewportElem || !(viewportElem instanceof HTMLElement)) {
    console.error("[EVtree] Viewport element not found");
    return;
  }

  toPng(viewportElem, {
    backgroundColor: "transparent",
    width: imageWidth,
    height: imageHeight,
    style: {
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  }).then((dataUrl) => downloadImage(dataUrl, filename));
};

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");

  a.setAttribute("download", filename);
  a.setAttribute("href", dataUrl);
  a.click();
}
