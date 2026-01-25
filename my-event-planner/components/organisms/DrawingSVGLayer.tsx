// components/organisms/DrawingSVGLayer.tsx
// SVG layer for rendering drawing shapes on the canvas
// Renders shapes sorted by z-index with selection and interaction handling

'use client';

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useDrawingStore } from '@/store/drawingStore';
import { DrawingShape } from '@/types/DrawingShape';

// ============================================================================
// TYPES
// ============================================================================

interface DrawingSVGLayerProps {
  containerRef: SVGGElement | null;
  zoomTransform: d3.ZoomTransform | null;
  isActive: boolean;
}

// ============================================================================
// SINGLE SHAPE COMPONENT
// ============================================================================

interface SingleShapeProps {
  shape: DrawingShape;
  isSelected: boolean;
  isActive: boolean;
  zoomScale: number;
  onSelect: () => void;
  onUpdatePosition: (x: number, y: number) => void;
}

function SingleShape({ 
  shape, 
  isSelected, 
  isActive, 
  zoomScale,
  onSelect, 
  onUpdatePosition 
}: SingleShapeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ 
    mouseX: number; 
    mouseY: number; 
    shapeX: number; 
    shapeY: number 
  } | null>(null);
  
  // Safe defaults for all shape properties
  const shapeX = typeof shape.x === 'number' && !isNaN(shape.x) ? shape.x : 200;
  const shapeY = typeof shape.y === 'number' && !isNaN(shape.y) ? shape.y : 200;
  const shapeWidth = typeof shape.width === 'number' && !isNaN(shape.width) && shape.width > 0 ? shape.width : 120;
  const shapeHeight = typeof shape.height === 'number' && !isNaN(shape.height) && shape.height > 0 ? shape.height : 80;
  const fillColor = shape.fillColor || '#9C27B0';
  const strokeColor = shape.strokeColor || fillColor;
  const strokeWidth = typeof shape.strokeWidth === 'number' ? shape.strokeWidth : 2;
  const shapeOpacity = typeof shape.opacity === 'number' ? shape.opacity : 0.85;
  const endX = typeof shape.endX === 'number' ? shape.endX : 100;
  const endY = typeof shape.endY === 'number' ? shape.endY : 0;
  const shapeType = shape.type || 'rectangle';
  
  // Debug: log shape on mount
  useEffect(() => {
    console.log('[SingleShape] Rendering:', {
      id: shape.id,
      type: shapeType,
      x: shapeX,
      y: shapeY,
      width: shapeWidth,
      height: shapeHeight,
      fill: fillColor
    });
  }, [shape.id, shapeType, shapeX, shapeY, shapeWidth, shapeHeight, fillColor]);
  
  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isActive) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    onSelect();
    setIsDragging(true);
    
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      shapeX: shapeX,
      shapeY: shapeY,
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      
      const deltaX = (moveEvent.clientX - dragStartRef.current.mouseX) / zoomScale;
      const deltaY = (moveEvent.clientY - dragStartRef.current.mouseY) / zoomScale;
      
      const newX = dragStartRef.current.shapeX + deltaX;
      const newY = dragStartRef.current.shapeY + deltaY;
      
      onUpdatePosition(newX, newY);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isActive, onSelect, onUpdatePosition, shapeX, shapeY, zoomScale]);
  
  // Selection border style
  const selectionStroke = '#1976d2';
  const selectionDash = '6 3';
  
  // Cursor style
  const cursorStyle = isActive ? (isDragging ? 'grabbing' : 'grab') : 'default';
  
  // =========== RENDER LINE ===========
  if (shapeType === 'line') {
    return (
      <g 
        transform={`translate(${shapeX}, ${shapeY})`}
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
      >
        {/* Hit area */}
        <line
          x1={0} y1={0} x2={endX} y2={endY}
          stroke="transparent"
          strokeWidth={20}
        />
        {/* Visible line */}
        <line
          x1={0} y1={0} x2={endX} y2={endY}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={shapeOpacity}
        />
        {/* Selection handles */}
        {isSelected && (
          <>
            <circle cx={0} cy={0} r={5} fill={selectionStroke} stroke="#fff" strokeWidth={2} />
            <circle cx={endX} cy={endY} r={5} fill={selectionStroke} stroke="#fff" strokeWidth={2} />
          </>
        )}
      </g>
    );
  }
  
  // =========== RENDER ARROW ===========
  if (shapeType === 'arrow') {
    return (
      <g 
        transform={`translate(${shapeX}, ${shapeY})`}
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
      >
        {/* Hit area */}
        <line
          x1={0} y1={0} x2={endX} y2={endY}
          stroke="transparent"
          strokeWidth={20}
        />
        {/* Visible arrow */}
        <line
          x1={0} y1={0} x2={endX} y2={endY}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={shapeOpacity}
          markerEnd="url(#drawing-arrow-marker)"
        />
        {/* Selection handles */}
        {isSelected && (
          <>
            <circle cx={0} cy={0} r={5} fill={selectionStroke} stroke="#fff" strokeWidth={2} />
            <circle cx={endX} cy={endY} r={5} fill={selectionStroke} stroke="#fff" strokeWidth={2} />
          </>
        )}
      </g>
    );
  }
  
  // =========== RENDER ELLIPSE ===========
  if (shapeType === 'ellipse') {
    const rx = shapeWidth / 2;
    const ry = shapeHeight / 2;
    
    return (
      <g 
        transform={`translate(${shapeX}, ${shapeY})`}
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
      >
        {/* Main ellipse */}
        <ellipse
          cx={0} cy={0}
          rx={rx} ry={ry}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={shapeOpacity}
        />
        {/* Text */}
        {shape.text && (
          <text
            x={0} y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fill={shape.textColor || '#fff'}
            fontSize={shape.fontSize || 14}
            fontWeight={shape.fontBold ? 'bold' : 'normal'}
            style={{ pointerEvents: 'none' }}
          >
            {shape.text}
          </text>
        )}
        {/* Selection highlight */}
        {isSelected && (
          <ellipse
            cx={0} cy={0}
            rx={rx + 5} ry={ry + 5}
            fill="none"
            stroke={selectionStroke}
            strokeWidth={2}
            strokeDasharray={selectionDash}
          />
        )}
      </g>
    );
  }
  
  // =========== RENDER DIAMOND ===========
  if (shapeType === 'diamond') {
    const hw = shapeWidth / 2;
    const hh = shapeHeight / 2;
    const points = `0,${-hh} ${hw},0 0,${hh} ${-hw},0`;
    const selPoints = `0,${-hh - 5} ${hw + 5},0 0,${hh + 5} ${-hw - 5},0`;
    
    return (
      <g 
        transform={`translate(${shapeX}, ${shapeY})`}
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
      >
        {/* Main diamond */}
        <polygon
          points={points}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={shapeOpacity}
        />
        {/* Text */}
        {shape.text && (
          <text
            x={0} y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fill={shape.textColor || '#fff'}
            fontSize={shape.fontSize || 14}
            fontWeight={shape.fontBold ? 'bold' : 'normal'}
            style={{ pointerEvents: 'none' }}
          >
            {shape.text}
          </text>
        )}
        {/* Selection highlight */}
        {isSelected && (
          <polygon
            points={selPoints}
            fill="none"
            stroke={selectionStroke}
            strokeWidth={2}
            strokeDasharray={selectionDash}
          />
        )}
      </g>
    );
  }
  
  // =========== RENDER RECTANGLE (default) ===========
  const halfW = shapeWidth / 2;
  const halfH = shapeHeight / 2;
  
  return (
    <g 
      transform={`translate(${shapeX}, ${shapeY})`}
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
    >
      {/* Main rectangle */}
      <rect
        x={-halfW} y={-halfH}
        width={shapeWidth}
        height={shapeHeight}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rx={4} ry={4}
        opacity={shapeOpacity}
      />
      {/* Text */}
      {shape.text && (
        <text
          x={0} y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fill={shape.textColor || '#fff'}
          fontSize={shape.fontSize || 14}
          fontWeight={shape.fontBold ? 'bold' : 'normal'}
          style={{ pointerEvents: 'none' }}
        >
          {shape.text}
        </text>
      )}
      {/* Selection highlight */}
      {isSelected && (
        <rect
          x={-halfW - 5} y={-halfH - 5}
          width={shapeWidth + 10}
          height={shapeHeight + 10}
          fill="none"
          stroke={selectionStroke}
          strokeWidth={2}
          strokeDasharray={selectionDash}
          rx={6} ry={6}
        />
      )}
    </g>
  );
}

// ============================================================================
// MAIN LAYER COMPONENT
// ============================================================================

export default function DrawingSVGLayer({ 
  containerRef, 
  zoomTransform, 
  isActive 
}: DrawingSVGLayerProps) {
  // Store selectors
  const shapes = useDrawingStore((state) => state.shapes);
  const selectedShapeId = useDrawingStore((state) => state.selectedShapeId);
  const selectShape = useDrawingStore((state) => state.selectShape);
  const updateShape = useDrawingStore((state) => state.updateShape);
  
  // Sort shapes by z-index (memoized)
  const sortedShapes = useMemo(() => {
    return [...shapes].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [shapes]);
  
  // Get zoom scale
  const zoomScale = zoomTransform?.k ?? 1;
  
  // Update shape position handler
  const handleUpdatePosition = useCallback(
    (shapeId: string, x: number, y: number) => {
      updateShape(shapeId, { x, y });
    },
    [updateShape]
  );
  
  // Debug: log when shapes change
  useEffect(() => {
    console.log('[DrawingSVGLayer] Shapes count:', shapes.length, 'Container:', !!containerRef);
  }, [shapes.length, containerRef]);
  
  // Don't render without container
  if (!containerRef) {
    console.log('[DrawingSVGLayer] No container ref, not rendering');
    return null;
  }
  
  // Create the portal content
  return createPortal(
    <React.Fragment>
      {/* Arrow marker definition */}
      <defs>
        <marker
          id="drawing-arrow-marker"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#9C27B0" />
        </marker>
      </defs>
      
      {/* Render all shapes */}
      {sortedShapes.map((shape) => (
        <SingleShape
          key={shape.id}
          shape={shape}
          isSelected={shape.id === selectedShapeId}
          isActive={isActive}
          zoomScale={zoomScale}
          onSelect={() => selectShape(shape.id)}
          onUpdatePosition={(x, y) => handleUpdatePosition(shape.id, x, y)}
        />
      ))}
    </React.Fragment>,
    containerRef
  );
}