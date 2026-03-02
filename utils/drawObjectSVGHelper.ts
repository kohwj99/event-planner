/**
 * D3-based SVG rendering helpers for draw layer objects.
 * Uses the shape registry for extensible rendering.
 */
import * as d3 from "d3";
import { v4 as uuidv4 } from "uuid";
import {
  DrawObject,
  DrawObjectShape,
  DEFAULT_DRAW_STYLE,
  DEFAULT_DRAW_TEXT,
} from "@/types/DrawObject";
import { getShapeConfig } from "@/utils/drawShapeRegistry";
import { HistoryActionLabel } from "@/store/historyStore";
import { DrawTool } from "@/store/drawUIStore";

/* ====================================================================
 * TYPES
 * ==================================================================== */

export interface DrawLayerCallbacks {
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragEnd: () => void;
  onResize: (id: string, width: number, height: number) => void;
  onUpdate: (id: string, data: Partial<DrawObject>) => void;
  onAdd: (obj: DrawObject) => void;
  captureSnapshot: (label: HistoryActionLabel) => void;
}

/* ====================================================================
 * HELPERS
 * ==================================================================== */

/**
 * Build the SVG transform string for a draw object.
 * Applies translation and optional rotation around the object's center.
 */
function buildTransform(d: DrawObject): string {
  if (d.rotation) {
    const cx = d.width / 2;
    const cy = d.height / 2;
    return `translate(${d.x},${d.y}) rotate(${d.rotation}, ${cx}, ${cy})`;
  }
  return `translate(${d.x},${d.y})`;
}

/* ====================================================================
 * MAIN RENDER: data-join on draw objects
 * ==================================================================== */

/**
 * Render all draw objects into the draw layer <g> using D3 data join.
 */
export function renderDrawLayer(
  drawLayerGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  drawObjects: DrawObject[],
  selectedId: string | null,
  isDrawMode: boolean,
  isLocked: boolean,
  callbacks: DrawLayerCallbacks,
): void {
  // Sort by zIndex so lower zIndex renders first (behind)
  const sorted = [...drawObjects].sort((a, b) => a.zIndex - b.zIndex);

  // D3 data join
  const groups = drawLayerGroup
    .selectAll<SVGGElement, DrawObject>(".draw-object-group")
    .data(sorted, (d) => d.id);

  // EXIT
  groups.exit().remove();

  // ENTER
  const enter = groups
    .enter()
    .append("g")
    .attr("class", "draw-object-group");

  // MERGE (enter + update)
  const merged = enter.merge(groups);

  merged
    .attr("transform", (d) => buildTransform(d))
    .style("pointer-events", isDrawMode && !isLocked ? "all" : "none")
    .style("cursor", isDrawMode && !isLocked ? "move" : "default");

  // Render each shape via registry
  merged.each(function (d) {
    const gEl = this as SVGGElement;
    const isSelected = d.id === selectedId;
    const config = getShapeConfig(d.shape);
    if (config) {
      config.render(gEl, d, isSelected && isDrawMode);
    }
  });

  // Resize handles + rotation handle for selected object
  merged.each(function (d) {
    const gEl = d3.select<SVGGElement, DrawObject>(this as SVGGElement);
    gEl.selectAll(".draw-resize-handle").remove();
    gEl.selectAll(".draw-rotation-handle").remove();
    gEl.selectAll(".draw-rotation-line").remove();

    if (d.id === selectedId && isDrawMode && !isLocked) {
      renderResizeHandles(
        gEl as d3.Selection<SVGGElement, DrawObject, SVGGElement | null, unknown>,
        d,
        callbacks,
      );
      renderRotationHandle(
        gEl as d3.Selection<SVGGElement, DrawObject, SVGGElement | null, unknown>,
        d,
        drawLayerGroup,
        callbacks,
      );
    }
  });

  // Click handler for selection
  if (isDrawMode && !isLocked) {
    merged.on("click", function (event, d) {
      event.stopPropagation();
      callbacks.onSelect(d.id);
    });

    // Drag behavior for moving objects
    const drag = d3
      .drag<SVGGElement, DrawObject>()
      .on("start", function (_event, d) {
        callbacks.captureSnapshot("Move Draw Object");
        callbacks.onSelect(d.id);
      })
      .on("drag", function (event, d) {
        const newX = d.x + event.dx;
        const newY = d.y + event.dy;
        d.x = newX;
        d.y = newY;
        d3.select(this).attr("transform", buildTransform(d));
        // Update store + expand canvas on every drag event (mirrors table drag)
        callbacks.onMove(d.id, d.x, d.y);
      })
      .on("end", function (_event, d) {
        callbacks.onMove(d.id, d.x, d.y);
        callbacks.onDragEnd();
      });

    merged.call(drag);
  } else {
    merged.on("click", null);
    merged.on(".drag", null);
  }
}

/* ====================================================================
 * RESIZE HANDLES
 * ==================================================================== */

const HANDLE_SIZE = 8;

function renderResizeHandles(
  group: d3.Selection<SVGGElement, DrawObject, SVGGElement | null, unknown>,
  obj: DrawObject,
  callbacks: DrawLayerCallbacks,
): void {
  // Corner positions: [x, y, cursor]
  const corners: Array<{
    cx: number;
    cy: number;
    cursor: string;
    resize: (dx: number, dy: number) => { x: number; y: number; w: number; h: number };
  }> = [
    {
      // Bottom-right
      cx: obj.width,
      cy: obj.height,
      cursor: "nwse-resize",
      resize: (dx, dy) => ({
        x: obj.x,
        y: obj.y,
        w: Math.max(20, obj.width + dx),
        h: Math.max(20, obj.height + dy),
      }),
    },
    {
      // Bottom-left
      cx: 0,
      cy: obj.height,
      cursor: "nesw-resize",
      resize: (dx, dy) => ({
        x: obj.x + dx,
        y: obj.y,
        w: Math.max(20, obj.width - dx),
        h: Math.max(20, obj.height + dy),
      }),
    },
    {
      // Top-right
      cx: obj.width,
      cy: 0,
      cursor: "nesw-resize",
      resize: (dx, dy) => ({
        x: obj.x,
        y: obj.y + dy,
        w: Math.max(20, obj.width + dx),
        h: Math.max(20, obj.height - dy),
      }),
    },
    {
      // Top-left
      cx: 0,
      cy: 0,
      cursor: "nwse-resize",
      resize: (dx, dy) => ({
        x: obj.x + dx,
        y: obj.y + dy,
        w: Math.max(20, obj.width - dx),
        h: Math.max(20, obj.height - dy),
      }),
    },
  ];

  corners.forEach((corner) => {
    const handle = group
      .append("rect")
      .attr("class", "draw-resize-handle")
      .attr("x", corner.cx - HANDLE_SIZE / 2)
      .attr("y", corner.cy - HANDLE_SIZE / 2)
      .attr("width", HANDLE_SIZE)
      .attr("height", HANDLE_SIZE)
      .attr("fill", "#1976d2")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("cursor", corner.cursor);

    const drag = d3
      .drag<SVGRectElement, unknown>()
      .on("start", function () {
        callbacks.captureSnapshot("Resize Draw Object");
      })
      .on("drag", function (event) {
        // Transform dx/dy from screen space to local object space when rotated
        let dx = event.dx;
        let dy = event.dy;
        if (obj.rotation) {
          const rad = -(obj.rotation) * Math.PI / 180;
          dx = event.dx * Math.cos(rad) - event.dy * Math.sin(rad);
          dy = event.dx * Math.sin(rad) + event.dy * Math.cos(rad);
        }
        const result = corner.resize(dx, dy);
        // Update object data for next frame
        obj.x = result.x;
        obj.y = result.y;
        obj.width = result.w;
        obj.height = result.h;
        // Re-render parent group position (with rotation)
        group.attr("transform", buildTransform(obj));
        // Re-render shape (will rebuild children)
        const config = getShapeConfig(obj.shape);
        if (config) {
          // Remove everything except resize handles and rotation handles
          group
            .selectAll(":not(.draw-resize-handle):not(.draw-rotation-handle):not(.draw-rotation-line)")
            .remove();
          config.render(group.node()!, obj, true);
        }
      })
      .on("end", function () {
        callbacks.onUpdate(obj.id, {
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
        });
      });

    (handle as unknown as d3.Selection<SVGRectElement, unknown, null, undefined>).call(drag);
  });
}

/* ====================================================================
 * ROTATION HANDLE
 * ==================================================================== */

const ROTATION_HANDLE_OFFSET = 25;
const ROTATION_HANDLE_RADIUS = 5;

/**
 * Render a rotation handle above the top-center of a selected object.
 * Dragging the handle rotates the object around its center.
 */
function renderRotationHandle(
  group: d3.Selection<SVGGElement, DrawObject, SVGGElement | null, unknown>,
  obj: DrawObject,
  drawLayerGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  callbacks: DrawLayerCallbacks,
): void {
  const topCenterX = obj.width / 2;
  const topCenterY = 0;
  const handleY = topCenterY - ROTATION_HANDLE_OFFSET;

  // Connector line from top-center to the rotation handle
  group
    .append("line")
    .attr("class", "draw-rotation-line")
    .attr("x1", topCenterX)
    .attr("y1", topCenterY)
    .attr("x2", topCenterX)
    .attr("y2", handleY)
    .attr("stroke", "#1976d2")
    .attr("stroke-width", 1.5)
    .attr("pointer-events", "none");

  // Rotation handle circle
  const handle = group
    .append("circle")
    .attr("class", "draw-rotation-handle")
    .attr("cx", topCenterX)
    .attr("cy", handleY)
    .attr("r", ROTATION_HANDLE_RADIUS)
    .attr("fill", "#1976d2")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("cursor", "grab");

  // Drag behavior for rotation
  const drag = d3
    .drag<SVGCircleElement, unknown>()
    .on("start", function () {
      callbacks.captureSnapshot("Rotate Draw Object");
      d3.select(this).style("cursor", "grabbing");
    })
    .on("drag", function (event) {
      // The object center in world space
      const centerX = obj.x + obj.width / 2;
      const centerY = obj.y + obj.height / 2;

      // Convert mouse position to world coordinates via the draw layer's CTM
      const svgEl = (drawLayerGroup.node()?.ownerSVGElement) as SVGSVGElement | null;
      if (!svgEl) return;

      const point = svgEl.createSVGPoint();
      point.x = event.sourceEvent.clientX;
      point.y = event.sourceEvent.clientY;
      const ctm = drawLayerGroup.node()?.getScreenCTM();
      if (!ctm) return;
      const worldPt = point.matrixTransform(ctm.inverse());

      // Calculate angle from center to mouse position
      // atan2 gives angle from positive X axis; we want 0 = up, so add 90
      const angle = Math.atan2(worldPt.y - centerY, worldPt.x - centerX) * (180 / Math.PI) + 90;

      // Normalize to 0-360
      obj.rotation = ((angle % 360) + 360) % 360;

      // Re-render the group transform
      group.attr("transform", buildTransform(obj));
    })
    .on("end", function () {
      d3.select(this).style("cursor", "grab");
      callbacks.onUpdate(obj.id, { rotation: obj.rotation });
    });

  (handle as unknown as d3.Selection<SVGCircleElement, unknown, null, undefined>).call(drag);
}

/* ====================================================================
 * DRAW CREATION: click-drag to create new shapes
 * ==================================================================== */

/**
 * Set up click-drag creation behavior on the SVG.
 * Returns a cleanup function to remove the listener.
 */
export function setupDrawCreation(
  svgEl: SVGSVGElement,
  zoomLayerEl: SVGGElement,
  activeTool: DrawTool,
  defaultStyle: typeof DEFAULT_DRAW_STYLE,
  nextZIndex: number,
  callbacks: DrawLayerCallbacks,
): () => void {
  if (activeTool === "select") {
    return () => {};
  }

  const shape = activeTool as DrawObjectShape;
  const config = getShapeConfig(shape);
  if (!config) return () => {};

  let isCreating = false;
  let startWorldX = 0;
  let startWorldY = 0;
  let previewGroup: SVGGElement | null = null;

  const handleMouseDown = (e: MouseEvent) => {
    // Only respond to left click on the SVG background
    const target = e.target as Element;
    if (
      target.closest(".draw-object-group") ||
      target.closest(".table-group") ||
      target.closest(".draw-resize-handle")
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const t = d3.zoomTransform(svgEl);
    const rect = svgEl.getBoundingClientRect();
    startWorldX = ((e.clientX - rect.left) - t.x) / t.k;
    startWorldY = ((e.clientY - rect.top) - t.y) / t.k;
    isCreating = true;

    // Create preview group in draw layer
    const drawLayer = d3.select(zoomLayerEl).select<SVGGElement>(".draw-layer");
    previewGroup = drawLayer
      .append("g")
      .attr("class", "draw-creation-preview")
      .attr("transform", `translate(${startWorldX},${startWorldY})`)
      .attr("opacity", 0.6)
      .node();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isCreating || !previewGroup) return;

    const t = d3.zoomTransform(svgEl);
    const rect = svgEl.getBoundingClientRect();
    const currentWorldX = ((e.clientX - rect.left) - t.x) / t.k;
    const currentWorldY = ((e.clientY - rect.top) - t.y) / t.k;

    const x = Math.min(startWorldX, currentWorldX);
    const y = Math.min(startWorldY, currentWorldY);
    const width = Math.abs(currentWorldX - startWorldX);
    const height = Math.abs(currentWorldY - startWorldY);

    d3.select(previewGroup).attr("transform", `translate(${x},${y})`);

    // Render preview using the shape's renderer
    const previewObj: DrawObject = {
      id: "preview",
      shape,
      x,
      y,
      width: Math.max(width, 2),
      height: Math.max(height, 2),
      rotation: 0,
      style: defaultStyle,
      zIndex: nextZIndex,
    };

    config.render(previewGroup, previewObj, false);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isCreating) return;
    isCreating = false;

    // Remove preview
    if (previewGroup) {
      previewGroup.remove();
      previewGroup = null;
    }

    const t = d3.zoomTransform(svgEl);
    const rect = svgEl.getBoundingClientRect();
    const endWorldX = ((e.clientX - rect.left) - t.x) / t.k;
    const endWorldY = ((e.clientY - rect.top) - t.y) / t.k;

    const x = Math.min(startWorldX, endWorldX);
    const y = Math.min(startWorldY, endWorldY);
    let width = Math.abs(endWorldX - startWorldX);
    let height = Math.abs(endWorldY - startWorldY);

    // Enforce minimum size
    if (width < config.minWidth && height < config.minHeight) {
      // Too small - treat as a click, not a drag. Use default size.
      width = config.minWidth * 3;
      height = config.minHeight * 3;
    } else {
      width = Math.max(width, config.minWidth);
      height = Math.max(height, config.minHeight);
    }

    const newObj: DrawObject = {
      id: uuidv4(),
      shape,
      x,
      y,
      width,
      height,
      rotation: 0,
      style: { ...defaultStyle },
      text: config.supportsText ? { ...DEFAULT_DRAW_TEXT } : undefined,
      zIndex: nextZIndex,
    };

    callbacks.captureSnapshot("Add Draw Object");
    callbacks.onAdd(newObj);
    callbacks.onSelect(newObj.id);
  };

  svgEl.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);

  return () => {
    svgEl.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };
}
