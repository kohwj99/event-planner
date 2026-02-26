'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Typography,
  Alert,
  Paper,
  Chip,
  Box,
} from '@mui/material';
import { GridView } from '@mui/icons-material';
import { ChunkLayoutConfig } from '@/utils/chunkLayoutHelper';

interface ChunkLayoutModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (config: ChunkLayoutConfig) => void;
  tableCount: number;
}

export default function ChunkLayoutModal({
  open,
  onClose,
  onApply,
  tableCount,
}: ChunkLayoutModalProps) {
  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(1);
  const [tablesPerChunk, setTablesPerChunk] = useState(1);

  // Auto-compute default tablesPerChunk when grid dimensions or tableCount change
  useEffect(() => {
    if (!open) return;
    const totalChunks = rows * cols;
    setTablesPerChunk(Math.max(1, Math.ceil(tableCount / totalChunks)));
  }, [rows, cols, tableCount, open]);

  // Reset to sensible defaults when modal opens
  useEffect(() => {
    if (open) {
      setRows(1);
      setCols(1);
      setTablesPerChunk(Math.max(1, tableCount));
    }
  }, [open, tableCount]);

  const totalCapacity = rows * cols * tablesPerChunk;
  const overflow = Math.max(0, tableCount - totalCapacity);

  const handleApply = () => {
    onApply({ rows, cols, tablesPerChunk });
  };

  // Clamp helper for number inputs
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  // Generate preview data: which tables go in which chunk cell
  const previewData = useMemo(() => {
    const cells: { chunkRow: number; chunkCol: number; tableNumbers: number[] }[] = [];
    const tpc = Math.max(1, tablesPerChunk);

    // Build all configured cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ chunkRow: r, chunkCol: c, tableNumbers: [] });
      }
    }

    // Assign table numbers to cells
    let tableIdx = 0;
    for (let cellIdx = 0; cellIdx < cells.length && tableIdx < tableCount; cellIdx++) {
      const count = Math.min(tpc, tableCount - tableIdx);
      for (let t = 0; t < count; t++) {
        cells[cellIdx].tableNumbers.push(tableIdx + 1);
        tableIdx++;
      }
    }

    // Handle overflow: add extra cells
    while (tableIdx < tableCount) {
      const overflowRow = Math.floor(cells.length / cols);
      const overflowCol = cells.length % cols;
      const cell = { chunkRow: overflowRow, chunkCol: overflowCol, tableNumbers: [] as number[] };
      const count = Math.min(tpc, tableCount - tableIdx);
      for (let t = 0; t < count; t++) {
        cell.tableNumbers.push(tableIdx + 1);
        tableIdx++;
      }
      cells.push(cell);
    }

    return cells;
  }, [rows, cols, tablesPerChunk, tableCount]);

  // SVG preview dimensions
  const previewWidth = 380;
  const previewHeight = 280;
  const previewPad = 10;
  const totalRows = previewData.length > 0
    ? Math.max(...previewData.map((c) => c.chunkRow)) + 1
    : rows;
  const totalCols = cols;
  const chunkW = (previewWidth - 2 * previewPad) / totalCols;
  const chunkH = (previewHeight - 2 * previewPad) / totalRows;

  // Sub-grid for dots within a chunk cell
  const tpc = Math.max(1, tablesPerChunk);
  const subCols = Math.ceil(Math.sqrt(tpc));
  const subRows = Math.ceil(tpc / subCols);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GridView />
          <Typography variant="h6" fontWeight="bold">Chunk Layout</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Arrange existing tables into a grid of chunks. Tables are placed in reading order (left-to-right, top-to-bottom).
        </Typography>

        <Stack direction="row" spacing={3}>
          {/* Left column: Configuration */}
          <Stack spacing={2} sx={{ minWidth: 220 }}>
            <TextField
              label="Rows"
              type="number"
              size="small"
              value={rows}
              onChange={(e) => setRows(clamp(parseInt(e.target.value) || 1, 1, 10))}
              inputProps={{ min: 1, max: 10 }}
              fullWidth
            />
            <TextField
              label="Columns"
              type="number"
              size="small"
              value={cols}
              onChange={(e) => setCols(clamp(parseInt(e.target.value) || 1, 1, 10))}
              inputProps={{ min: 1, max: 10 }}
              fullWidth
            />
            <TextField
              label="Tables per Chunk"
              type="number"
              size="small"
              value={tablesPerChunk}
              onChange={(e) => setTablesPerChunk(clamp(parseInt(e.target.value) || 1, 1, 20))}
              inputProps={{ min: 1, max: 20 }}
              fullWidth
            />

            <Stack spacing={1}>
              <Chip
                label={`Total Capacity: ${totalCapacity} tables`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Existing Tables: ${tableCount}`}
                size="small"
                color="default"
                variant="outlined"
              />
            </Stack>

            {overflow > 0 && (
              <Alert severity="warning" variant="outlined">
                Not enough capacity. {overflow} table(s) will overflow into extra chunks.
              </Alert>
            )}

            {tableCount === 0 && (
              <Alert severity="info" variant="outlined">
                No tables to arrange. Add tables first.
              </Alert>
            )}
          </Stack>

          {/* Right column: SVG Preview */}
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.50',
              p: 1,
            }}
          >
            <svg
              width={previewWidth}
              height={previewHeight}
              viewBox={`0 0 ${previewWidth} ${previewHeight}`}
            >
              {previewData.map((cell, cellIdx) => {
                const cx = previewPad + cell.chunkCol * chunkW;
                const cy = previewPad + cell.chunkRow * chunkH;
                const isOverflow = cell.chunkRow >= rows;

                return (
                  <g key={cellIdx}>
                    {/* Chunk cell rectangle */}
                    <rect
                      x={cx + 1}
                      y={cy + 1}
                      width={chunkW - 2}
                      height={chunkH - 2}
                      fill={cell.tableNumbers.length > 0 ? '#e3f2fd' : '#fafafa'}
                      stroke={isOverflow ? '#ff9800' : '#90caf9'}
                      strokeWidth={1}
                      strokeDasharray={isOverflow ? '4 2' : 'none'}
                      rx={3}
                    />

                    {/* Table dots within the chunk */}
                    {cell.tableNumbers.map((tNum, tIdx) => {
                      const lCol = tIdx % subCols;
                      const lRow = Math.floor(tIdx / subCols);
                      const dotPadX = chunkW * 0.15;
                      const dotPadY = chunkH * 0.15;
                      const dotCellW = (chunkW - 2 * dotPadX) / subCols;
                      const dotCellH = (chunkH - 2 * dotPadY) / subRows;
                      const dotX = cx + dotPadX + (lCol + 0.5) * dotCellW;
                      const dotY = cy + dotPadY + (lRow + 0.5) * dotCellH;
                      const dotRadius = Math.min(dotCellW, dotCellH, chunkW, chunkH) * 0.15;

                      return (
                        <g key={tNum}>
                          <circle
                            cx={dotX}
                            cy={dotY}
                            r={Math.max(4, Math.min(dotRadius, 14))}
                            fill="#1976d2"
                            opacity={0.8}
                          />
                          {/* Table number label - only show if dots are large enough */}
                          {dotRadius > 6 && (
                            <text
                              x={dotX}
                              y={dotY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="white"
                              fontSize={Math.max(7, Math.min(dotRadius * 0.8, 11))}
                              fontWeight="bold"
                            >
                              {tNum}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={tableCount === 0}
        >
          Apply Layout
        </Button>
      </DialogActions>
    </Dialog>
  );
}
