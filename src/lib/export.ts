import { omit } from "es-toolkit";
import { fromPairs, toPairs } from "es-toolkit/compat";

import { AppNode } from "./node";
import { DecisionTree } from "./tree";

/**
 * Export an HTML element as PNG
 */
export const exportHTMLElementAsPNG = async (
  element: HTMLElement,
  filename: string,
  backgroundColor: string,
) => {
  const { toPng } = await import("html-to-image");
  toPng(element, {
    backgroundColor,
    pixelRatio: 2, // Higher quality for text
  }).then((dataUrl) => exportImage(dataUrl, filename));
};

// NOTE: see https://reactflow.dev/examples/misc/download-image
export const exportPNG = async (
  nodes: AppNode[],
  filename: string,
  backgroundColor: string,
  isDarkMode: boolean,
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
  const rightPaddingExtra = 20; // Extra padding for terminal node labels
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
  const viewport = calculateViewport(
    bounds,
    imageWidth,
    imageHeight,
    rightPaddingExtra,
  );

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

  try {
    const dataUrl = await toPng(viewportElem, {
      backgroundColor,
      width: imageWidth,
      height: imageHeight,
      style: {
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });

    // Add watermark to the PNG
    try {
      const watermarkedDataUrl = await addWatermarkToPNG(
        dataUrl,
        imageWidth,
        imageHeight,
        isDarkMode,
      );
      exportImage(watermarkedDataUrl, filename);
    } catch (error) {
      console.error("[EVTree] Failed to add watermark:", error);
      // Fallback to original image if watermarking fails
      exportImage(dataUrl, filename);
    }
  } catch (error) {
    console.error("[EVTree] Failed to export PNG:", error);
  } finally {
    // Clean up temporary SVG
    viewportElem.removeChild(tempSvg);
  }
};

export function exportImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");

  a.setAttribute("download", filename);
  a.setAttribute("href", dataUrl);
  a.click();
}

/**
 * Add TreeDecisions watermark with favicon to bottom left of PNG
 */
async function addWatermarkToPNG(
  dataUrl: string,
  imageWidth: number,
  imageHeight: number,
  isDarkMode: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    const img = new Image();
    img.onload = () => {
      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Load favicon
      const favicon = new Image();
      favicon.onload = () => {
        const padding = 10;
        const logoSize = 24;
        const fontSize = 18;
        const textOffset = 8;

        // Use semi-transparent colors (50% opacity)
        ctx.fillStyle = isDarkMode
          ? "rgba(255, 255, 255, 0.5)"
          : "rgba(0, 0, 0, 0.5)";
        // TODO: base this on actual Tailwind CSS colors

        // Draw favicon with transparency and invert in dark mode
        ctx.globalAlpha = 0.5;

        // Invert the favicon color in dark mode
        if (isDarkMode) {
          ctx.filter = "invert(1)";
        }

        ctx.drawImage(
          favicon,
          padding,
          imageHeight - padding - logoSize,
          logoSize,
          logoSize,
        );

        // Reset filter
        ctx.filter = "none";

        // Draw text with transparency
        // TODO: unify with globals.css
        ctx.font = `${fontSize}px Geist, sans-serif`;
        ctx.fillText(
          "Made with TreeDecisions.app",
          padding + logoSize + textOffset,
          imageHeight - padding - logoSize / 2 + fontSize / 3,
        );

        ctx.globalAlpha = 1.0; // Reset opacity

        resolve(canvas.toDataURL("image/png"));
      };
      favicon.onerror = () => reject(new Error("Failed to load favicon"));
      favicon.src = "/favicon.svg";
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
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

export const exportJson = (tree: DecisionTree, filename: string) => {
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
    // TODO: throw error?
    return { x: 0, y: 0, width: 100, height: 100 };
  }

  // Default node dimensions if not measured
  // See also layout.ts
  const defaultNodeWidth = 150;
  const defaultNodeHeight = 72;

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
  rightPaddingExtra: number = 0,
): { x: number; y: number; zoom: number } {
  // Add padding around the content
  const padding = 50;

  // Calculate zoom to fit content with padding (accounting for asymmetric right padding)
  const zoomX =
    (imageWidth - padding - padding - rightPaddingExtra) / bounds.width;
  const zoomY = (imageHeight - 2 * padding) / bounds.height;
  const zoom = Math.min(zoomX, zoomY, 2); // Max zoom of 2x

  // Center the content horizontally accounting for extra right padding
  const scaledWidth = bounds.width * zoom;
  const scaledHeight = bounds.height * zoom;

  const x =
    (imageWidth - scaledWidth - rightPaddingExtra) / 2 - bounds.x * zoom;
  const y = (imageHeight - scaledHeight) / 2 - bounds.y * zoom;

  return { x, y, zoom };
}

/**
 * Export nodes as PDF by converting to PNG first, then embedding in PDF.
 *
 * Adds a title to the upper left of the PDF.
 */
export const exportPDF = async (
  nodes: AppNode[],
  filename: string,
  isDarkMode: boolean,
  title: string,
) => {
  const backgroundColor = isDarkMode
    ? "#171717" // neutral-900, see globals.css
    : "#fffbeb"; // amber-50, same as Reactflow default

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

  try {
    const dataUrl = await toPng(viewportElem, {
      backgroundColor,
      width: imageWidth,
      height: imageHeight,
      style: {
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    });

    // Add watermark to the PNG first
    try {
      const watermarkedDataUrl = await addWatermarkToPNG(
        dataUrl,
        imageWidth,
        imageHeight,
        isDarkMode,
      );

      // Determine orientation from PNG dimensions
      const orientation = imageWidth > imageHeight ? "landscape" : "portrait";

      // Standard Letter size: 8.5" x 11"
      // Convert inches to mm: 1 inch = 25.4 mm
      const letterWidthMm = 8.5 * 25.4; // 215.9 mm
      const letterHeightMm = 11 * 25.4; // 279.4 mm

      const pdfWidth =
        orientation === "landscape" ? letterHeightMm : letterWidthMm;
      const pdfHeight =
        orientation === "landscape" ? letterWidthMm : letterHeightMm;

      // Create PDF with determined orientation
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: "letter",
      });

      // Fill background with same color as PNG
      const bgColor: [number, number, number] = isDarkMode
        ? [23, 23, 23] // neutral-900 RGB: #171717
        : [255, 251, 235]; // amber-50 RGB: #fffbeb
      pdf.setFillColor(...bgColor);
      pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

      // Calculate scaled dimensions to fit PDF while maintaining aspect ratio
      const imageAspectRatio = imageWidth / imageHeight;
      const pdfAspectRatio = pdfWidth / pdfHeight;

      let scaledWidth: number;
      let scaledHeight: number;
      let offsetX = 0;
      let offsetY = 0;

      if (imageAspectRatio > pdfAspectRatio) {
        // Image is wider than PDF page - fit to width
        scaledWidth = pdfWidth;
        scaledHeight = pdfWidth / imageAspectRatio;
        offsetY = (pdfHeight - scaledHeight) / 2;
      } else {
        // Image is taller than PDF page - fit to height
        scaledHeight = pdfHeight;
        scaledWidth = pdfHeight * imageAspectRatio;
        offsetX = (pdfWidth - scaledWidth) / 2;
      }

      // Add the watermarked image to the PDF with proper aspect ratio
      pdf.addImage(
        watermarkedDataUrl,
        "PNG",
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight,
      );

      // Add title to upper left if provided
      if (title) {
        const fontSize = 16;
        const padding = 10;
        pdf.setFontSize(fontSize);

        // Determine if background is dark to use appropriate text/background colors
        const textColor: [number, number, number] = isDarkMode
          ? [255, 255, 255]
          : [0, 0, 0]; // White or black text
        // TODO: base this on actual Tailwind CSS colors

        pdf.setTextColor(...textColor);

        // Add the title text
        pdf.text(title, padding, padding);
      }

      // Save the PDF
      pdf.save(filename);
    } catch (error) {
      console.error("[EVTree] Failed to add watermark for PDF:", error);
      // Fallback: create PDF without watermark if watermarking fails
    }
  } catch (error) {
    console.error("[EVTree] Failed to export PDF:", error);
  } finally {
    // Clean up temporary SVG
    viewportElem.removeChild(tempSvg);
  }
};
