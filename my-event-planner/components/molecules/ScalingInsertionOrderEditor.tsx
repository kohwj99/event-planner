// components/molecules/ScalingInsertionOrderEditor.tsx
// Visual editor for defining the order in which new seats are added during scaling
// 
// HOW IT WORKS:
// - User clicks on table edges in the order they want new seats added
// - This sequence repeats as the table scales
// 
// EXAMPLES:
// 1. Single side (BOTTOM only scalable):
//    Click BOTTOM-LEFT then BOTTOM-RIGHT
//    → Seats added: B-Left, B-Right, B-Left, B-Right, ...
//
// 2. Two sides (TOP and BOTTOM scalable):
//    Click TOP-RIGHT → BOTTOM-RIGHT → BOTTOM-LEFT → TOP-LEFT
//    → Seats added in that order, then repeats
//
// 3. Restrict to specific edges:
//    Click only BOTTOM-LEFT and TOP-LEFT
//    → All new seats only added to left edges, alternating sides

'use client';

import { useState, useEffect } from 'react';
import {
  Stack,
  Typography,
  Box,
  Paper,
  Chip,
  Button,
  IconButton,
  Alert,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Refresh,
  Undo,
  Delete,
  Add,
} from '@mui/icons-material';

// ============================================================================
// TYPES
// ============================================================================

export type SideKey = 'top' | 'right' | 'bottom' | 'left';
export type EdgePosition = 'start' | 'end'; // start = left/top, end = right/bottom

export interface InsertionPoint {
  side: SideKey;
  edge: EdgePosition;
}

export interface ScalingInsertionOrderEditorProps {
  scalableSides: SideKey[];
  insertionOrder: InsertionPoint[];
  onChange: (order: InsertionPoint[]) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function getEdgeLabel(side: SideKey, edge: EdgePosition): string {
  const isHorizontal = side === 'top' || side === 'bottom';
  if (isHorizontal) {
    return edge === 'start' ? 'Left' : 'Right';
  } else {
    return edge === 'start' ? 'Top' : 'Bottom';
  }
}

function getFullLabel(point: InsertionPoint): string {
  const sideLabel = point.side.charAt(0).toUpperCase() + point.side.slice(1);
  const edgeLabel = getEdgeLabel(point.side, point.edge);
  return `${sideLabel} ${edgeLabel}`;
}

function getShortLabel(point: InsertionPoint): string {
  const sideChar = point.side.charAt(0).toUpperCase();
  const edgeChar = getEdgeLabel(point.side, point.edge).charAt(0);
  return `${sideChar}-${edgeChar}`;
}

// ============================================================================
// VISUAL TABLE WITH CLICKABLE EDGES
// ============================================================================

interface VisualTableProps {
  scalableSides: SideKey[];
  insertionOrder: InsertionPoint[];
  onEdgeClick: (side: SideKey, edge: EdgePosition) => void;
}

function VisualTable({ scalableSides, insertionOrder, onEdgeClick }: VisualTableProps) {
  // Find order number for an edge (null if not in sequence)
  const getOrderNumber = (side: SideKey, edge: EdgePosition): number | null => {
    const idx = insertionOrder.findIndex(p => p.side === side && p.edge === edge);
    return idx >= 0 ? idx + 1 : null;
  };

  // Check if edge is already assigned
  const isAssigned = (side: SideKey, edge: EdgePosition): boolean => {
    return insertionOrder.some(p => p.side === side && p.edge === edge);
  };

  // Render an edge button
  const renderEdge = (side: SideKey, edge: EdgePosition, position: React.CSSProperties) => {
    if (!scalableSides.includes(side)) return null;
    
    const orderNum = getOrderNumber(side, edge);
    const assigned = isAssigned(side, edge);
    const label = getEdgeLabel(side, edge);
    const nextNum = insertionOrder.length + 1;

    return (
      <Tooltip 
        title={assigned ? `#${orderNum} in sequence` : `Click to add as #${nextNum}`}
        arrow
      >
        <Box
          onClick={() => !assigned && onEdgeClick(side, edge)}
          sx={{
            position: 'absolute',
            ...position,
            width: 50,
            height: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
            cursor: assigned ? 'default' : 'pointer',
            bgcolor: assigned ? '#4caf50' : '#fff',
            border: assigned ? '2px solid #2e7d32' : '2px dashed #1976d2',
            color: assigned ? 'white' : 'primary.main',
            fontWeight: 'bold',
            fontSize: 12,
            transition: 'all 0.15s',
            zIndex: 10,
            '&:hover': !assigned ? {
              bgcolor: '#e3f2fd',
              transform: 'scale(1.1)',
              boxShadow: 2,
            } : {},
          }}
        >
          {assigned ? (
            <>
              <Typography variant="caption" fontWeight="bold" lineHeight={1}>
                #{orderNum}
              </Typography>
            </>
          ) : (
            <Add fontSize="small" />
          )}
        </Box>
      </Tooltip>
    );
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: 320,
        height: 240,
        mx: 'auto',
      }}
    >
      {/* The table rectangle */}
      <Box
        sx={{
          position: 'absolute',
          left: 60,
          top: 50,
          width: 200,
          height: 140,
          bgcolor: '#e8e8e8',
          border: '3px solid #9e9e9e',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          TABLE
        </Typography>
      </Box>

      {/* TOP side edges */}
      {scalableSides.includes('top') && (
        <>
          {/* TOP LEFT edge */}
          {renderEdge('top', 'start', { left: 65, top: 10 })}
          {/* TOP RIGHT edge */}
          {renderEdge('top', 'end', { right: 65, top: 10 })}
          {/* Label */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: '50%',
              top: 16,
              transform: 'translateX(-50%)',
              color: 'text.secondary',
            }}
          >
            TOP
          </Typography>
        </>
      )}

      {/* BOTTOM side edges */}
      {scalableSides.includes('bottom') && (
        <>
          {/* BOTTOM LEFT edge */}
          {renderEdge('bottom', 'start', { left: 65, bottom: 10 })}
          {/* BOTTOM RIGHT edge */}
          {renderEdge('bottom', 'end', { right: 65, bottom: 10 })}
          {/* Label */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 16,
              transform: 'translateX(-50%)',
              color: 'text.secondary',
            }}
          >
            BOTTOM
          </Typography>
        </>
      )}

      {/* LEFT side edges */}
      {scalableSides.includes('left') && (
        <>
          {/* LEFT TOP edge */}
          {renderEdge('left', 'start', { left: 2, top: 55 })}
          {/* LEFT BOTTOM edge */}
          {renderEdge('left', 'end', { left: 2, bottom: 55 })}
          {/* Label */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%) rotate(-90deg)',
              color: 'text.secondary',
            }}
          >
            LEFT
          </Typography>
        </>
      )}

      {/* RIGHT side edges */}
      {scalableSides.includes('right') && (
        <>
          {/* RIGHT TOP edge */}
          {renderEdge('right', 'start', { right: 2, top: 55 })}
          {/* RIGHT BOTTOM edge */}
          {renderEdge('right', 'end', { right: 2, bottom: 55 })}
          {/* Label */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%) rotate(90deg)',
              color: 'text.secondary',
            }}
          >
            RIGHT
          </Typography>
        </>
      )}
    </Box>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ScalingInsertionOrderEditor({
  scalableSides,
  insertionOrder,
  onChange,
}: ScalingInsertionOrderEditorProps) {
  const [history, setHistory] = useState<InsertionPoint[][]>([]);

  // Reset history when scalable sides change
  useEffect(() => {
    setHistory([]);
  }, [scalableSides.join(',')]);

  // Handle edge click - add to sequence
  const handleEdgeClick = (side: SideKey, edge: EdgePosition) => {
    // Already in sequence? Ignore
    if (insertionOrder.some(p => p.side === side && p.edge === edge)) return;
    
    setHistory(prev => [...prev, insertionOrder]);
    onChange([...insertionOrder, { side, edge }]);
  };

  // Undo last
  const handleUndo = () => {
    if (insertionOrder.length > 0) {
      setHistory(prev => [...prev, insertionOrder]);
      onChange(insertionOrder.slice(0, -1));
    }
  };

  // Clear all
  const handleReset = () => {
    if (insertionOrder.length > 0) {
      setHistory(prev => [...prev, insertionOrder]);
      onChange([]);
    }
  };

  // Remove specific item
  const handleRemoveItem = (index: number) => {
    setHistory(prev => [...prev, insertionOrder]);
    onChange(insertionOrder.filter((_, i) => i !== index));
  };

  // Count total possible edges
  const totalPossibleEdges = scalableSides.length * 2;

  return (
    <Stack spacing={3}>
      {/* Instructions */}
      <Alert severity="info">
        <Typography variant="body2" fontWeight="bold" gutterBottom>
          Define the order new seats are added when scaling
        </Typography>
        <Typography variant="caption" component="div">
          Click on the edge buttons around the table in the order you want new seats to appear.
          This pattern repeats as the table grows.
        </Typography>
      </Alert>

      {/* Controls */}
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Chip 
          label={`${insertionOrder.length} / ${totalPossibleEdges} edges selected`}
          color={insertionOrder.length > 0 ? 'success' : 'default'}
          variant="outlined"
        />
        <Stack direction="row" spacing={1}>
          <Tooltip title="Undo last">
            <span>
              <IconButton 
                size="small" 
                onClick={handleUndo}
                disabled={insertionOrder.length === 0}
              >
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={handleReset}
            disabled={insertionOrder.length === 0}
            variant="outlined"
          >
            Clear
          </Button>
        </Stack>
      </Stack>

      {/* Visual table with clickable edges */}
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
        <VisualTable
          scalableSides={scalableSides}
          insertionOrder={insertionOrder}
          onEdgeClick={handleEdgeClick}
        />
      </Paper>

      <Divider />

      {/* Sequence display */}
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Insertion Sequence:
        </Typography>
        
        {insertionOrder.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No sequence defined yet. Click the edge buttons above to define where new seats are added.
          </Typography>
        ) : (
          <Stack spacing={1}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center">
              {insertionOrder.map((point, index) => (
                <Stack key={index} direction="row" alignItems="center" spacing={0.5}>
                  <Chip
                    label={`${index + 1}. ${getFullLabel(point)}`}
                    color="success"
                    size="small"
                    onDelete={() => handleRemoveItem(index)}
                    deleteIcon={<Delete fontSize="small" />}
                    sx={{ fontWeight: 'bold' }}
                  />
                  {index < insertionOrder.length - 1 && (
                    <Typography variant="body2" color="text.secondary">→</Typography>
                  )}
                </Stack>
              ))}
              <Typography variant="body2" color="primary" fontWeight="bold" sx={{ ml: 1 }}>
                → repeats...
              </Typography>
            </Stack>
          </Stack>
        )}
      </Paper>

      {/* Scaling preview */}
      {insertionOrder.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, border: '1px solid #a5d6a7' }}>
          <Typography variant="subtitle2" gutterBottom color="success.dark">
            Scaling Preview:
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            When the table scales up, new seats are added in this order:
          </Typography>
          <Stack spacing={0.5}>
            {[1, 2, 3, 4, 5, 6].map(n => {
              const point = insertionOrder[(n - 1) % insertionOrder.length];
              return (
                <Typography key={n} variant="body2">
                  <strong>+{n} seat:</strong> {getFullLabel(point)} edge
                </Typography>
              );
            })}
            {insertionOrder.length < 6 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                ... pattern continues
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {/* Example scenarios */}
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom color="warning.dark">
          Examples:
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="caption">
            • <strong>Alternate left-right on one side:</strong> Click Bottom-Left, then Bottom-Right
          </Typography>
          <Typography variant="caption">
            • <strong>Fill left edges first:</strong> Click only Bottom-Left and Top-Left
          </Typography>
          <Typography variant="caption">
            • <strong>Cross pattern:</strong> Click Top-Right → Bottom-Left → Top-Left → Bottom-Right
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { getFullLabel, getShortLabel, getEdgeLabel };