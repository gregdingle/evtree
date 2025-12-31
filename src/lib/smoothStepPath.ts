import { Position } from "@xyflow/react";

/**
 * Custom smooth step path calculation with absolute pixel step position.
 * Forked from @xyflow/react's getSmoothStepPath to use absolute pixel values
 * instead of relative 0-1 positioning.
 *
 * @param sourceX - Source node X coordinate
 * @param sourceY - Source node Y coordinate
 * @param sourcePosition - Position of the source handle
 * @param targetX - Target node X coordinate
 * @param targetY - Target node Y coordinate
 * @param targetPosition - Position of the target handle
 * @param stepPositionPx - Absolute pixel distance from source for the vertical segment
 * @param borderRadius - Radius for rounded corners
 * @returns [path, labelX, labelY, offsetX, offsetY]
 */
export function getSmoothStepPathWithAbsoluteStep({
  sourceX,
  sourceY,
  sourcePosition = Position.Bottom,
  targetX,
  targetY,
  targetPosition = Position.Top,
  stepPositionPx = 100,
  borderRadius = 5,
}: {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  stepPositionPx?: number;
  borderRadius?: number;
}): [
  path: string,
  labelX: number,
  labelY: number,
  offsetX: number,
  offsetY: number,
] {
  const [centerX, centerY, offsetX, offsetY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const isHorizontal =
    sourcePosition === Position.Left || sourcePosition === Position.Right;
  const isVertical =
    sourcePosition === Position.Top || sourcePosition === Position.Bottom;

  // Calculate the step position as absolute pixels from source
  let stepX = sourceX;
  let stepY = sourceY;

  if (isHorizontal) {
    const direction = sourcePosition === Position.Right ? 1 : -1;
    stepX = sourceX + stepPositionPx * direction;
  } else if (isVertical) {
    const direction = sourcePosition === Position.Bottom ? 1 : -1;
    stepY = sourceY + stepPositionPx * direction;
  }

  const path = buildSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    stepX,
    stepY,
    borderRadius,
  });

  return [path, centerX, centerY, offsetX, offsetY];
}

function getEdgeCenter({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}): [number, number, number, number] {
  const xOffset = Math.abs(targetX - sourceX) / 2;
  const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;

  const yOffset = Math.abs(targetY - sourceY) / 2;
  const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;

  return [centerX, centerY, xOffset, yOffset];
}

interface Point {
  x: number;
  y: number;
}

function buildSmoothStepPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  stepX,
  stepY,
  borderRadius,
}: {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  stepX: number;
  stepY: number;
  borderRadius: number;
}): string {
  const isSourceHorizontal =
    sourcePosition === Position.Left || sourcePosition === Position.Right;
  const isTargetHorizontal =
    targetPosition === Position.Left || targetPosition === Position.Right;

  // Build array of points that define the path
  const points: Point[] = [{ x: sourceX, y: sourceY }];

  if (isSourceHorizontal && isTargetHorizontal) {
    // Horizontal to horizontal
    points.push({ x: stepX, y: sourceY });
    points.push({ x: stepX, y: targetY });
    points.push({ x: targetX, y: targetY });
  } else if (!isSourceHorizontal && !isTargetHorizontal) {
    // Vertical to vertical
    points.push({ x: sourceX, y: stepY });
    points.push({ x: targetX, y: stepY });
    points.push({ x: targetX, y: targetY });
  } else if (isSourceHorizontal && !isTargetHorizontal) {
    // Horizontal to vertical
    points.push({ x: stepX, y: sourceY });
    points.push({ x: stepX, y: targetY });
    points.push({ x: targetX, y: targetY });
  } else {
    // Vertical to horizontal
    points.push({ x: sourceX, y: stepY });
    points.push({ x: targetX, y: stepY });
    points.push({ x: targetX, y: targetY });
  }

  // Build the path string with rounded corners
  return points.reduce<string>((pathStr, point, i) => {
    if (i === 0) {
      return `M${point.x} ${point.y}`;
    }

    if (i > 0 && i < points.length - 1) {
      // This is an intermediate point, add a rounded bend
      const prev = points[i - 1];
      const next = points[i + 1];
      if (prev && next) {
        const segment = getBend(prev, point, next, borderRadius);
        return pathStr + segment;
      }
    }

    // This is the last point, just draw a line
    return pathStr + `L${point.x} ${point.y}`;
  }, "");
}

function distance(a: Point, b: Point): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

function getBend(a: Point, b: Point, c: Point, size: number): string {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  const { x, y } = b;

  // no bend - points are collinear
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
    return `L${x} ${y}`;
  }

  // first segment is horizontal
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1;
    const yDir = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
  }

  // first segment is vertical
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}
