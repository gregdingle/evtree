import { omit } from "es-toolkit";
import { fromPairs, toPairs } from "es-toolkit/compat";

import { AppNode } from "./node";
import { DecisionTree } from "./tree";

/**
 * Export an HTML element as PNG
 */
export const downloadHTMLElementAsPNG = async (
  element: HTMLElement,
  filename: string,
  backgroundColor: string,
) => {
  const { toPng } = await import("html-to-image");
  toPng(element, {
    backgroundColor,
    pixelRatio: 2, // Higher quality for text
  }).then((dataUrl) => downloadImage(dataUrl, filename));
};

// NOTE: see https://reactflow.dev/examples/misc/download-image
export const downloadPNG = async (
  nodes: AppNode[],
  filename: string,
  backgroundColor: string,
) => {
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
    maxImageSize,
  );

  // Calculate viewport transform
  const viewport = calculateViewport(bounds, imageWidth, imageHeight);

  const viewportElem = window.document.querySelector(".react-flow__viewport");
  if (!viewportElem || !(viewportElem instanceof HTMLElement)) {
    console.error("[EVTree] Viewport element not found");
    return;
  }

  // Clone arrow marker definitions into viewport to ensure they're captured
  const markerDefs = window.document.querySelectorAll(
    'svg marker[id^="arrow"]',
  );
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  tempSvg.setAttribute("width", "0");
  tempSvg.setAttribute("height", "0");
  tempSvg.style.position = "absolute";
  tempSvg.style.top = "0";
  tempSvg.style.left = "0";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  markerDefs.forEach((marker) => {
    defs.appendChild(marker.cloneNode(true));
  });
  tempSvg.appendChild(defs);
  viewportElem.appendChild(tempSvg);

  const { toPng } = await import("html-to-image");

  toPng(viewportElem, {
    backgroundColor,
    width: imageWidth,
    height: imageHeight,
    style: {
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })
    .then((dataUrl: string) => {
      downloadImage(dataUrl, filename);
    })
    .catch((error: Error) => {
      console.error("[EVTree] Failed to export PNG:", error);
    })
    .finally(() => {
      // Clean up temporary SVG
      viewportElem.removeChild(tempSvg);
    });
};

export function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");

  a.setAttribute("download", filename);
  a.setAttribute("href", dataUrl);
  a.click();
}

export const cleanTree = (tree: DecisionTree): DecisionTree => {
  // Omit selected property from nodes and edges to create cleaner export
  const cleanTree: DecisionTree = {
    ...tree,
    nodes: fromPairs(
      toPairs(tree.nodes).map(([id, node]) => [id, omit(node, ["selected"])]),
    ),
    edges: fromPairs(
      toPairs(tree.edges).map(([id, edge]) => [id, omit(edge, ["selected"])]),
    ),
  };
  return cleanTree;
};

export const downloadJson = (tree: DecisionTree, filename: string) => {
  const json = JSON.stringify(cleanTree(tree), null, 2);
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
  imageHeight: number,
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

/**
 * Export nodes as PDF by converting to PNG first, then embedding in PDF
 */
export const downloadPDF = async (
  nodes: AppNode[],
  filename: string,
  backgroundColor: string,
) => {
  // Check if we have nodes to export
  if (nodes.length === 0) {
    console.error("[EVTree] No nodes to export");
    return;
  }

  nodes = nodes.filter((node) => !node.hidden);

  // Calculate bounding box first to determine dynamic image size
  const bounds = calculateNodesBounds(nodes);

  // Make width and height dynamic to fit small and large trees
  const padding = 100;
  const minImageSize = 400;
  const maxImageSize = 4096;

  // Calculate base image size based on content bounds with padding
  const baseWidth = bounds.width + 2 * (padding * 2);
  const baseHeight = bounds.height + 2 * padding;

  // Ensure minimum size and cap at maximum size
  const imageWidth = Math.min(Math.max(baseWidth, minImageSize), maxImageSize);
  const imageHeight = Math.min(
    Math.max(baseHeight, minImageSize),
    maxImageSize,
  );

  // Calculate viewport transform
  const viewport = calculateViewport(bounds, imageWidth, imageHeight);

  const viewportElem = window.document.querySelector(".react-flow__viewport");
  if (!viewportElem || !(viewportElem instanceof HTMLElement)) {
    console.error("[EVTree] Viewport element not found");
    return;
  }

  // Clone arrow marker definitions into viewport
  const markerDefs = window.document.querySelectorAll(
    'svg marker[id^="arrow"]',
  );
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  tempSvg.setAttribute("width", "0");
  tempSvg.setAttribute("height", "0");
  tempSvg.style.position = "absolute";
  tempSvg.style.top = "0";
  tempSvg.style.left = "0";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  markerDefs.forEach((marker) => {
    defs.appendChild(marker.cloneNode(true));
  });
  tempSvg.appendChild(defs);
  viewportElem.appendChild(tempSvg);

  const { toPng } = await import("html-to-image");
  const { default: jsPDF } = await import("jspdf");

  toPng(viewportElem, {
    backgroundColor,
    width: imageWidth,
    height: imageHeight,
    style: {
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  })
    .then((dataUrl: string) => {
      // Create PDF with appropriate dimensions
      // Convert pixels to mm (assuming 96 DPI: 1 inch = 25.4 mm, 96 px = 25.4 mm)
      const pxToMm = 25.4 / 96;
      const pdfWidth = imageWidth * pxToMm;
      const pdfHeight = imageHeight * pxToMm;

      // Determine orientation based on aspect ratio
      const orientation = pdfWidth > pdfHeight ? "landscape" : "portrait";

      // Create PDF with custom dimensions
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });

      // Add the image to the PDF
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);

      // Save the PDF
      pdf.save(filename);
    })
    .catch((error: Error) => {
      console.error("[EVTree] Failed to export PDF:", error);
    })
    .finally(() => {
      // Clean up temporary SVG
      viewportElem.removeChild(tempSvg);
    });
};
