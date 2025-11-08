// components/molecules/AddTableModal.tsx - CLEAN IMPLEMENTATION
import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  Box,
  Paper,
  Chip,
  Divider,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Refresh, RadioButtonUnchecked } from '@mui/icons-material';

export interface TableConfig {
  type: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  quantity: number;
  label: string;
  seatOrdering?: number[];
}

interface AddTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: TableConfig) => void;
}

type OrderingMode = 'clockwise' | 'counter-clockwise' | 'alternating';

/**
 * Generate seat ordering based on mode and start position
 * @param count - Total number of seats
 * @param mode - Ordering pattern
 * @param startPosition - Which physical position should be seat #1 (0-based index)
 */
const generateOrdering = (count: number, mode: OrderingMode, startPosition: number): number[] => {
  const result: number[] = new Array(count);
  
  if (mode === 'clockwise') {
    // Clockwise: 1, 2, 3, 4, ...
    // Starting from startPosition
    for (let i = 0; i < count; i++) {
      const position = (startPosition + i) % count;
      result[position] = i + 1;
    }
  } else if (mode === 'counter-clockwise') {
    // Counter-clockwise: 1, then go backwards
    // Starting from startPosition
    for (let i = 0; i < count; i++) {
      const position = (startPosition - i + count) % count;
      result[position] = i + 1;
    }
  } else if (mode === 'alternating') {
    // Alternating pattern centered on seat 1
    // For 12 seats starting at position 0:
    // Position 0 = Seat 1
    // Then split remaining seats:
    // - Odds (1,3,5,7,9,11) go counter-clockwise: positions before startPosition
    // - Evens (2,4,6,8,10,12) go clockwise: positions after startPosition
    
    result[startPosition] = 1; // Seat 1 at start position
    
    // Calculate how many odds and evens we have (excluding 1)
    const odds: number[] = []; // Will be 3, 5, 7, 9, 11
    const evens: number[] = []; // Will be 2, 4, 6, 8, 10, 12
    
    for (let i = 2; i <= count; i++) {
      if (i % 2 === 0) {
        evens.push(i);
      } else {
        odds.push(i);
      }
    }
    
    // Place evens clockwise from startPosition
    for (let i = 0; i < evens.length; i++) {
      const position = (startPosition + 1 + i) % count;
      result[position] = evens[i];
    }
    
    // Place odds counter-clockwise from startPosition
    for (let i = 0; i < odds.length; i++) {
      const position = (startPosition - 1 - i + count) % count;
      result[position] = odds[i];
    }
  }
  
  return result;
};

export default function AddTableModal({ open, onClose, onConfirm }: AddTableModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'ordering'>('config');
  
  const [tableConfig, setTableConfig] = useState<TableConfig>({
    type: 'round',
    roundSeats: 8,
    rectangleSeats: {
      top: 2,
      bottom: 2,
      left: 1,
      right: 1,
    },
    quantity: 1,
    label: '',
  });

  // Calculate total seats
  const totalSeats = useMemo(() => {
    if (tableConfig.type === 'round') {
      return tableConfig.roundSeats || 8;
    } else {
      const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
      return top + bottom + left + right;
    }
  }, [tableConfig]);

  // Ordering configuration
  const [orderingMode, setOrderingMode] = useState<OrderingMode>('clockwise');
  const [startPosition, setStartPosition] = useState<number>(0); // 0-based position index

  // Seat ordering (calculated based on mode and start position)
  const seatOrdering = useMemo(() => {
    return generateOrdering(totalSeats, orderingMode, startPosition);
  }, [totalSeats, orderingMode, startPosition]);

  // Reset when seats count changes
  useEffect(() => {
    setStartPosition(0);
  }, [totalSeats]);

  // Reset to defaults
  const handleResetOrdering = () => {
    setOrderingMode('clockwise');
    setStartPosition(0);
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm({
      ...tableConfig,
      seatOrdering,
    });
    onClose();
    
    // Reset for next use
    setActiveTab('config');
    setOrderingMode('clockwise');
    setStartPosition(0);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Add New Table(s)</Typography>
          {activeTab === 'ordering' && (
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={handleResetOrdering}
              variant="outlined"
            >
              Reset
            </Button>
          )}
        </Stack>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label="Table Configuration" value="config" />
        <Tab label="Seat Ordering" value="ordering" />
      </Tabs>

      <DialogContent sx={{ minHeight: 500 }}>
        {activeTab === 'config' ? (
          // Configuration Tab
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Table Type</InputLabel>
              <Select
                value={tableConfig.type}
                label="Table Type"
                onChange={(e) =>
                  setTableConfig((prev) => ({
                    ...prev,
                    type: e.target.value as 'round' | 'rectangle',
                  }))
                }
              >
                <MenuItem value="round">Round</MenuItem>
                <MenuItem value="rectangle">Rectangle</MenuItem>
              </Select>
            </FormControl>

            {tableConfig.type === 'round' ? (
              <TextField
                type="number"
                label="Number of Seats"
                value={tableConfig.roundSeats}
                onChange={(e) =>
                  setTableConfig((prev) => ({
                    ...prev,
                    roundSeats: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                inputProps={{ min: 1 }}
                helperText="Seats arranged clockwise starting from top"
              />
            ) : (
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="text.secondary">
                  Seats per side:
                </Typography>
                <Stack direction="row" spacing={2}>
                  <TextField
                    type="number"
                    label="Top"
                    value={tableConfig.rectangleSeats?.top}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          top: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                  <TextField
                    type="number"
                    label="Bottom"
                    value={tableConfig.rectangleSeats?.bottom}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          bottom: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField
                    type="number"
                    label="Left"
                    value={tableConfig.rectangleSeats?.left}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          left: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                  <TextField
                    type="number"
                    label="Right"
                    value={tableConfig.rectangleSeats?.right}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          right: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                        },
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                </Stack>
              </Stack>
            )}

            <TextField
              label="Table Label Prefix"
              value={tableConfig.label}
              onChange={(e) =>
                setTableConfig((prev) => ({
                  ...prev,
                  label: e.target.value,
                }))
              }
              helperText="A number will be appended to this prefix"
            />

            <TextField
              type="number"
              label="Quantity"
              value={tableConfig.quantity}
              onChange={(e) =>
                setTableConfig((prev) => ({
                  ...prev,
                  quantity: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                }))
              }
              inputProps={{ min: 1, max: 10 }}
              helperText="Number of tables to add (max 10)"
            />

            <Divider />

            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="caption" color="text.secondary">
                📌 Customize seat numbering in the "Seat Ordering" tab
              </Typography>
            </Paper>
          </Stack>
        ) : (
          // Seat Ordering Tab
          <Stack spacing={3} sx={{ height: '100%' }}>
            {/* Ordering Controls */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd' }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Ordering Pattern
                  </Typography>
                  <ToggleButtonGroup
                    value={orderingMode}
                    exclusive
                    onChange={(_, value) => value && setOrderingMode(value)}
                    fullWidth
                  >
                    <ToggleButton value="clockwise">
                      Clockwise
                    </ToggleButton>
                    <ToggleButton value="counter-clockwise">
                      Counter-Clockwise
                    </ToggleButton>
                    <ToggleButton value="alternating">
                      Alternating
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Seat #1 Position
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Click on any seat below to set it as Seat #1
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Preview */}
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#fafafa',
                minHeight: 300,
                p: 2,
              }}
            >
              {tableConfig.type === 'round' ? (
                <RoundTablePreview
                  seats={seatOrdering}
                  startPosition={startPosition}
                  onSelectStart={setStartPosition}
                />
              ) : (
                <RectangleTablePreview
                  top={tableConfig.rectangleSeats?.top || 0}
                  bottom={tableConfig.rectangleSeats?.bottom || 0}
                  left={tableConfig.rectangleSeats?.left || 0}
                  right={tableConfig.rectangleSeats?.right || 0}
                  seats={seatOrdering}
                  startPosition={startPosition}
                  onSelectStart={setStartPosition}
                />
              )}
            </Box>

            {/* Info */}
            <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#fff9c4' }}>
              <Typography variant="caption" color="text.secondary">
                💡 <strong>Pattern:</strong> {seatOrdering.join(', ')}
              </Typography>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          Add Table(s)
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Round Table Preview ---
interface RoundTablePreviewProps {
  seats: number[];
  startPosition: number;
  onSelectStart: (position: number) => void;
}

function RoundTablePreview({ seats, startPosition, onSelectStart }: RoundTablePreviewProps) {
  const size = Math.min(500, typeof window !== 'undefined' ? window.innerWidth * 0.6 : 500);
  const radius = size * 0.3;
  const seatRadius = size * 0.06;
  const center = size / 2;

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Table circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="#1976d2"
          stroke="#0d47a1"
          strokeWidth="3"
        />

        {/* Seats */}
        {seats.map((seatNumber, index) => {
          const angle = (index / seats.length) * 2 * Math.PI - Math.PI / 2;
          const x = center + Math.cos(angle) * (radius + seatRadius * 2.5);
          const y = center + Math.sin(angle) * (radius + seatRadius * 2.5);
          const isSeatOne = seatNumber === 1;
          const isStartPosition = index === startPosition;

          return (
            <g key={index} onClick={() => onSelectStart(index)} style={{ cursor: 'pointer' }}>
              {/* Highlight ring for seat #1 */}
              {isSeatOne && (
                <circle
                  cx={x}
                  cy={y}
                  r={seatRadius + 4}
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="3"
                />
              )}
              
              <circle
                cx={x}
                cy={y}
                r={seatRadius}
                fill={isSeatOne ? '#4caf50' : '#90caf9'}
                stroke={isSeatOne ? '#2e7d32' : '#1565c0'}
                strokeWidth="2"
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize={seatRadius * 0.7}
                fontWeight="bold"
                fill={isSeatOne ? 'white' : '#0d47a1'}
              >
                {seatNumber}
              </text>
              {/* Position indicator */}
              <text
                x={x}
                y={y + seatRadius * 2}
                textAnchor="middle"
                fontSize={seatRadius * 0.45}
                fill="#666"
              >
                P{index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <Chip
        label={`Seat #1 at Position ${startPosition + 1}`}
        color="success"
        size="small"
        sx={{ position: 'absolute', top: 8, left: 8 }}
      />
    </Box>
  );
}

// --- Rectangle Table Preview ---
interface RectangleTablePreviewProps {
  top: number;
  bottom: number;
  left: number;
  right: number;
  seats: number[];
  startPosition: number;
  onSelectStart: (position: number) => void;
}

function RectangleTablePreview({
  top,
  bottom,
  left,
  right,
  seats,
  startPosition,
  onSelectStart,
}: RectangleTablePreviewProps) {
  const containerWidth = Math.min(600, typeof window !== 'undefined' ? window.innerWidth * 0.7 : 600);
  const containerHeight = Math.min(400, typeof window !== 'undefined' ? window.innerHeight * 0.5 : 400);
  
  const tableWidth = containerWidth * 0.5;
  const tableHeight = containerHeight * 0.5;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;
  const seatRadius = Math.min(24, containerWidth * 0.04);
  const seatOffset = seatRadius * 2;

  // Calculate seat positions
  const seatPositions: { x: number; y: number }[] = [];

  // Top seats (left to right)
  for (let i = 0; i < top; i++) {
    const spacing = tableWidth / (top + 1);
    seatPositions.push({
      x: centerX - tableWidth / 2 + spacing * (i + 1),
      y: centerY - tableHeight / 2 - seatOffset,
    });
  }

  // Right seats (top to bottom)
  for (let i = 0; i < right; i++) {
    const spacing = tableHeight / (right + 1);
    seatPositions.push({
      x: centerX + tableWidth / 2 + seatOffset,
      y: centerY - tableHeight / 2 + spacing * (i + 1),
    });
  }

  // Bottom seats (right to left)
  for (let i = 0; i < bottom; i++) {
    const spacing = tableWidth / (bottom + 1);
    seatPositions.push({
      x: centerX + tableWidth / 2 - spacing * (i + 1),
      y: centerY + tableHeight / 2 + seatOffset,
    });
  }

  // Left seats (bottom to top)
  for (let i = 0; i < left; i++) {
    const spacing = tableHeight / (left + 1);
    seatPositions.push({
      x: centerX - tableWidth / 2 - seatOffset,
      y: centerY + tableHeight / 2 - spacing * (i + 1),
    });
  }

  return (
    <Box sx={{ position: 'relative', width: containerWidth, height: containerHeight }}>
      <svg width={containerWidth} height={containerHeight}>
        {/* Table rectangle */}
        <rect
          x={centerX - tableWidth / 2}
          y={centerY - tableHeight / 2}
          width={tableWidth}
          height={tableHeight}
          fill="#1976d2"
          stroke="#0d47a1"
          strokeWidth="3"
          rx="8"
        />

        {/* Seats */}
        {seats.map((seatNumber, index) => {
          const pos = seatPositions[index];
          if (!pos) return null;
          const isSeatOne = seatNumber === 1;

          return (
            <g key={index} onClick={() => onSelectStart(index)} style={{ cursor: 'pointer' }}>
              {isSeatOne && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={seatRadius + 4}
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="3"
                />
              )}
              
              <circle
                cx={pos.x}
                cy={pos.y}
                r={seatRadius}
                fill={isSeatOne ? '#4caf50' : '#90caf9'}
                stroke={isSeatOne ? '#2e7d32' : '#1565c0'}
                strokeWidth="2"
              />
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                fontSize={seatRadius * 0.65}
                fontWeight="bold"
                fill={isSeatOne ? 'white' : '#0d47a1'}
              >
                {seatNumber}
              </text>
              <text
                x={pos.x}
                y={pos.y + seatRadius * 1.8}
                textAnchor="middle"
                fontSize={seatRadius * 0.4}
                fill="#666"
              >
                P{index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <Chip
        label={`Seat #1 at Position ${startPosition + 1}`}
        color="success"
        size="small"
        sx={{ position: 'absolute', top: 8, left: 8 }}
      />
    </Box>
  );
}