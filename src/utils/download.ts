import { AppNode, DecisionTree } from "@/hooks/use-store";
import { omit } from "es-toolkit";
import { fromPairs, toPairs } from "es-toolkit/compat";
import { toPng } from "html-to-image";

// NOTE: see https://reactflow.dev/examples/misc/download-image
export const downloadPNG = (nodes: AppNode[], filename: string) => {
  // Check if we have nodes to export
  if (nodes.length === 0) {
    console.error("[EVTree] No nodes to export");
    return;
  }

  nodes = nodes.filter((node) => !node.hidden);

  // Calculate bounding box first to determine dynamic image size
  const bounds = calculateNodesBounds(nodes);

  // Make width and height dynamic to fit small and large trees
  const padding = 100; // Extra padding around the content
  const minImageSize = 400; // Minimum image dimensions
  const maxImageSize = 4096; // Maximum image dimensions for performance

  // Calculate base image size based on content bounds with padding
  const baseWidth = bounds.width + 2 * (padding * 2); // Double padding for horizontal
  const baseHeight = bounds.height + 2 * padding;

  // Ensure minimum size and cap at maximum size
  const imageWidth = Math.min(Math.max(baseWidth, minImageSize), maxImageSize);
  const imageHeight = Math.min(
    Math.max(baseHeight, minImageSize),
    maxImageSize
  );

  // Calculate viewport transform
  const viewport = calculateViewport(bounds, imageWidth, imageHeight);

  const viewportElem = window.document.querySelector(".react-flow__viewport");
  if (!viewportElem || !(viewportElem instanceof HTMLElement)) {
    console.error("[EVTree] Viewport element not found");
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

export const downloadJson = (tree: DecisionTree, filename: string) => {
  // Omit selected property from nodes and edges to create cleaner export
  const cleanTree: DecisionTree = {
    ...tree,
    nodes: fromPairs(
      toPairs(tree.nodes).map(([id, node]) => [id, omit(node, ["selected"])])
    ),
    edges: fromPairs(
      toPairs(tree.edges).map(([id, edge]) => [id, omit(edge, ["selected"])])
    ),
  };

  const json = JSON.stringify(cleanTree, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.setAttribute("download", filename);
  a.setAttribute("href", url);
  a.click();
};

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate bounding box for a set of nodes
 */
function calculateNodesBounds(nodes: AppNode[]): Bounds {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  // Default node dimensions if not measured
  const defaultNodeWidth = 100;
  const defaultNodeHeight = 50;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const nodeWidth = node.measured?.width ?? defaultNodeWidth;
    const nodeHeight = node.measured?.height ?? defaultNodeHeight;

    const nodeX = node.position.x;
    const nodeY = node.position.y;

    minX = Math.min(minX, nodeX);
    minY = Math.min(minY, nodeY);
    maxX = Math.max(maxX, nodeX + nodeWidth);
    maxY = Math.max(maxY, nodeY + nodeHeight);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate viewport transform to fit all nodes in the given dimensions
 */
function calculateViewport(
  bounds: Bounds,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; zoom: number } {
  // Add padding around the content
  const padding = 50;

  // Calculate zoom to fit content with padding
  const zoomX = (imageWidth - 2 * padding) / bounds.width;
  const zoomY = (imageHeight - 2 * padding) / bounds.height;
  const zoom = Math.min(zoomX, zoomY, 2); // Max zoom of 2x

  // Center the content
  const scaledWidth = bounds.width * zoom;
  const scaledHeight = bounds.height * zoom;

  const x = (imageWidth - scaledWidth) / 2 - bounds.x * zoom;
  const y = (imageHeight - scaledHeight) / 2 - bounds.y * zoom;

  return { x, y, zoom };
}
