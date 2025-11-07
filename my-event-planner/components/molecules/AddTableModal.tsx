// components/molecules/AddTableModal.tsx - ENHANCED
import { useState, useMemo } from 'react';
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
  IconButton,
  Chip,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import { SwapVert, Refresh } from '@mui/icons-material';

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
  seatOrdering?: number[]; // NEW: Custom seat ordering (maps position index to seat number)
}

interface AddTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: TableConfig) => void;
}

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

  // Calculate total seats for current configuration
  const totalSeats = useMemo(() => {
    if (tableConfig.type === 'round') {
      return tableConfig.roundSeats || 8;
    } else {
      const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
      return top + bottom + left + right;
    }
  }, [tableConfig]);

  // Initialize or reset seat ordering to default (1, 2, 3, ...)
  const [seatOrdering, setSeatOrdering] = useState<number[]>(() =>
    Array.from({ length: totalSeats }, (_, i) => i + 1)
  );

  // Update seat ordering when seat count changes
  useMemo(() => {
    setSeatOrdering(Array.from({ length: totalSeats }, (_, i) => i + 1));
  }, [totalSeats]);

  // Swap two seats in the ordering
  const handleSwapSeats = (indexA: number, indexB: number) => {
    const newOrdering = [...seatOrdering];
    [newOrdering[indexA], newOrdering[indexB]] = [newOrdering[indexB], newOrdering[indexA]];
    setSeatOrdering(newOrdering);
  };

  // Reset to default ordering
  const handleResetOrdering = () => {
    setSeatOrdering(Array.from({ length: totalSeats }, (_, i) => i + 1));
  };

  // Handle confirm with seat ordering
  const handleConfirm = () => {
    onConfirm({
      ...tableConfig,
      seatOrdering,
    });
    onClose();
    
    // Reset for next use
    setActiveTab('config');
    setSeatOrdering(Array.from({ length: totalSeats }, (_, i) => i + 1));
  };

  // Generate visual representation of seat positions
  const renderSeatPreview = () => {
    if (tableConfig.type === 'round') {
      return <RoundTablePreview seats={seatOrdering} onSwap={handleSwapSeats} />;
    } else {
      const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
      return (
        <RectangleTablePreview
          top={top}
          bottom={bottom}
          left={left}
          right={right}
          seats={seatOrdering}
          onSwap={handleSwapSeats}
        />
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
              Reset Order
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

      <DialogContent sx={{ minHeight: 400 }}>
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
                helperText="Seats will be arranged clockwise starting from the top"
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
                <Typography variant="caption" color="text.secondary">
                  Seat ordering: Top (left to right) → Right (top to bottom) → Bottom (right to left) → Left (bottom to top)
                </Typography>
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
                📌 <strong>Note:</strong> By default, seats are numbered clockwise starting from the top position.
                You can customize the seat numbering in the "Seat Ordering" tab.
              </Typography>
            </Paper>
          </Stack>
        ) : (
          // Seat Ordering Tab
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd' }}>
              <Typography variant="body2" gutterBottom>
                <strong>Customize Seat Numbering</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Click on any two seats to swap their numbers. The physical positions remain the same;
                only the seat numbers change. This affects the order in which guests are assigned during auto-fill.
              </Typography>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 300 }}>
              {renderSeatPreview()}
            </Box>

            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0' }}>
              <Typography variant="caption" color="text.secondary">
                💡 <strong>Adjacency Info:</strong> The system automatically tracks which seats are physically next to each other.
                This will be used for future guest placement rules (e.g., "VIP must sit next to specific person").
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

// --- Round Table Preview Component ---
interface RoundTablePreviewProps {
  seats: number[];
  onSwap: (indexA: number, indexB: number) => void;
}

function RoundTablePreview({ seats, onSwap }: RoundTablePreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSeatClick = (index: number) => {
    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else {
      if (selectedIndex !== index) {
        onSwap(selectedIndex, index);
      }
      setSelectedIndex(null);
    }
  };

  const radius = 100;
  const seatRadius = 28;
  const centerX = 150;
  const centerY = 150;

  return (
    <Box sx={{ position: 'relative', width: 300, height: 300 }}>
      <svg width="300" height="300">
        {/* Table circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="#1976d2"
          stroke="#0d47a1"
          strokeWidth="3"
        />

        {/* Seats */}
        {seats.map((seatNumber, index) => {
          const angle = (index / seats.length) * 2 * Math.PI - Math.PI / 2;
          const x = centerX + Math.cos(angle) * (radius + 40);
          const y = centerY + Math.sin(angle) * (radius + 40);
          const isSelected = selectedIndex === index;

          return (
            <g key={index} onClick={() => handleSeatClick(index)} style={{ cursor: 'pointer' }}>
              <circle
                cx={x}
                cy={y}
                r={seatRadius}
                fill={isSelected ? '#ff9800' : '#90caf9'}
                stroke={isSelected ? '#f57c00' : '#1565c0'}
                strokeWidth="2"
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize="16"
                fontWeight="bold"
                fill="#0d47a1"
              >
                {seatNumber}
              </text>
              {/* Position indicator */}
              <text
                x={x}
                y={y + 45}
                textAnchor="middle"
                fontSize="10"
                fill="#666"
              >
                Pos {index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      {selectedIndex !== null && (
        <Chip
          label={`Selected: Seat ${seats[selectedIndex]} (Pos ${selectedIndex + 1})`}
          color="warning"
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8 }}
        />
      )}
    </Box>
  );
}

// --- Rectangle Table Preview Component ---
interface RectangleTablePreviewProps {
  top: number;
  bottom: number;
  left: number;
  right: number;
  seats: number[];
  onSwap: (indexA: number, indexB: number) => void;
}

function RectangleTablePreview({
  top,
  bottom,
  left,
  right,
  seats,
  onSwap,
}: RectangleTablePreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSeatClick = (index: number) => {
    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else {
      if (selectedIndex !== index) {
        onSwap(selectedIndex, index);
      }
      setSelectedIndex(null);
    }
  };

  const tableWidth = 200;
  const tableHeight = 120;
  const centerX = 200;
  const centerY = 150;
  const seatRadius = 24;
  const seatOffset = 35;

  // Calculate seat positions
  const seatPositions: { x: number; y: number }[] = [];
  let posIndex = 0;

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
    <Box sx={{ position: 'relative', width: 400, height: 300 }}>
      <svg width="400" height="300">
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
          const isSelected = selectedIndex === index;

          return (
            <g key={index} onClick={() => handleSeatClick(index)} style={{ cursor: 'pointer' }}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={seatRadius}
                fill={isSelected ? '#ff9800' : '#90caf9'}
                stroke={isSelected ? '#f57c00' : '#1565c0'}
                strokeWidth="2"
              />
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
                fill="#0d47a1"
              >
                {seatNumber}
              </text>
              {/* Position indicator */}
              <text
                x={pos.x}
                y={pos.y + 40}
                textAnchor="middle"
                fontSize="9"
                fill="#666"
              >
                P{index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      {selectedIndex !== null && (
        <Chip
          label={`Selected: Seat ${seats[selectedIndex]} (Pos ${selectedIndex + 1})`}
          color="warning"
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8 }}
        />
      )}
    </Box>
  );
}