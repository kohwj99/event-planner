// components/molecules/AddTableModal.tsx - ENHANCED WITH SEAT MODE TAB
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
  Switch,
  FormControlLabel,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Refresh, Person, Public, RadioButtonUnchecked } from '@mui/icons-material';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';

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
  seatModes?: SeatMode[]; // NEW: Seat modes array
}

interface AddTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: TableConfig) => void;
}

type Direction = 'clockwise' | 'counter-clockwise';
type TabValue = 'config' | 'ordering' | 'modes';
type TopLevelTab = 'suggested' | 'custom';

/**
 * Generate seat ordering based on direction, alternating mode, and start position
 */
const generateOrdering = (
  count: number,
  direction: Direction,
  useAlternating: boolean,
  startPosition: number
): number[] => {
  const result: number[] = new Array(count);

  if (!useAlternating) {
    if (direction === 'clockwise') {
      for (let i = 0; i < count; i++) {
        const position = (startPosition + i) % count;
        result[position] = i + 1;
      }
    } else {
      for (let i = 0; i < count; i++) {
        const position = (startPosition - i + count) % count;
        result[position] = i + 1;
      }
    }
  } else {
    result[startPosition] = 1;

    const odds: number[] = [];
    const evens: number[] = [];

    for (let i = 2; i <= count; i++) {
      if (i % 2 === 0) {
        evens.push(i);
      } else {
        odds.push(i);
      }
    }

    if (direction === 'clockwise') {
      for (let i = 0; i < evens.length; i++) {
        const position = (startPosition + 1 + i) % count;
        result[position] = evens[i];
      }
      for (let i = 0; i < odds.length; i++) {
        const position = (startPosition - 1 - i + count) % count;
        result[position] = odds[i];
      }
    } else {
      for (let i = 0; i < evens.length; i++) {
        const position = (startPosition - 1 - i + count) % count;
        result[position] = evens[i];
      }
      for (let i = 0; i < odds.length; i++) {
        const position = (startPosition + 1 + i) % count;
        result[position] = odds[i];
      }
    }
  }

  return result;
};

/**
 * Generate a visual pattern example
 */
function generatePatternPreview(
  count: number,
  direction: Direction,
  useAlternating: boolean
): string {
  const ordering = generateOrdering(count, direction, useAlternating, 0);
  const maxShow = Math.min(12, count);
  const preview = ordering.slice(0, maxShow).join(' → ');
  return count > maxShow ? `${preview} ...` : preview;
}

export default function AddTableModal({ open, onClose, onConfirm }: AddTableModalProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('config');
  const [topTab, setTopTab] = useState<TopLevelTab>('custom');

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
  const [direction, setDirection] = useState<Direction>('counter-clockwise');
  const [useAlternating, setUseAlternating] = useState<boolean>(false);
  const [startPosition, setStartPosition] = useState<number>(0);

  // NEW: Seat modes state
  const [seatModes, setSeatModes] = useState<SeatMode[]>([]);

  // Seat ordering (calculated based on direction, alternating, and start position)
  const seatOrdering = useMemo(() => {
    return generateOrdering(totalSeats, direction, useAlternating, startPosition);
  }, [totalSeats, direction, useAlternating, startPosition]);

  // Initialize seat modes when seat count changes
  useEffect(() => {
    setSeatModes(Array.from({ length: totalSeats }, () => 'default' as SeatMode));
  }, [totalSeats]);

  // Reset when seats count changes
  useEffect(() => {
    setStartPosition(0);
  }, [totalSeats]);

  // Reset to defaults
  const handleResetOrdering = () => {
    setDirection('counter-clockwise');
    setUseAlternating(false);
    setStartPosition(0);
  };

  const handleResetModes = () => {
    setSeatModes(Array.from({ length: totalSeats }, () => 'default' as SeatMode));
  };

  // Handle seat mode change
  const handleSeatModeChange = (index: number, mode: SeatMode) => {
    setSeatModes(prev => {
      const newModes = [...prev];
      newModes[index] = mode;
      return newModes;
    });
  };

  // Set all seats to a specific mode
  const handleSetAllModes = (mode: SeatMode) => {
    setSeatModes(Array.from({ length: totalSeats }, () => mode));
  };

  // Handle confirm
  const handleConfirm = () => {
    onConfirm({
      ...tableConfig,
      seatOrdering,
      seatModes,
    });
    onClose();

    // Reset for next use
    setActiveTab('config');
    setDirection('counter-clockwise');
    setUseAlternating(false);
    setStartPosition(0);
    setSeatModes(Array.from({ length: totalSeats }, () => 'default' as SeatMode));
  };

  // Menu state for seat mode selection
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);

  const handleSeatClick = (event: React.MouseEvent<SVGGElement>, index: number) => {
    if (activeTab === 'modes') {
      setMenuAnchor(event.currentTarget as unknown as HTMLElement);
      setSelectedSeatIndex(index);
    } else if (activeTab === 'ordering') {
      setStartPosition(index);
    }
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedSeatIndex(null);
  };

  const handleMenuSelect = (mode: SeatMode) => {
    if (selectedSeatIndex !== null) {
      handleSeatModeChange(selectedSeatIndex, mode);
    }
    handleMenuClose();
  };

  // Count modes for summary
  const modeCounts = useMemo(() => {
    const counts: Record<SeatMode, number> = {
      'default': 0,
      'host-only': 0,
      'external-only': 0,
    };
    seatModes.forEach(mode => {
      counts[mode]++;
    });
    return counts;
  }, [seatModes]);

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
          {activeTab === 'modes' && (
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={handleResetModes}
              variant="outlined"
            >
              Reset All
            </Button>
          )}
        </Stack>
      </DialogTitle>
      <Tabs
        value={topTab}
        onChange={(_, v) => setTopTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label="Suggested" value="suggested" />
        <Tab label="Custom" value="custom" />
      </Tabs>
      {topTab === 'custom' && (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
          >
            <Tab label="Table Configuration" value="config" />
            <Tab label="Seat Ordering" value="ordering" />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <span>Seat Modes</span>
                  {(modeCounts['host-only'] > 0 || modeCounts['external-only'] > 0) && (
                    <Chip
                      size="small"
                      label={`${modeCounts['host-only']}H / ${modeCounts['external-only']}E`}
                      color="primary"
                      sx={{ height: 20, fontSize: 10 }}
                    />
                  )}
                </Stack>
              }
              value="modes"
            />
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
                    helperText="Seats arranged starting from top"
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
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    🎯 Set guest type restrictions in the "Seat Modes" tab
                  </Typography>
                </Paper>
              </Stack>
            ) : activeTab === 'ordering' ? (
              // Seat Ordering Tab
              <Stack spacing={3} sx={{ height: '100%' }}>
                {/* Ordering Controls */}
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd' }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="subtitle2">Direction:</Typography>
                      <ToggleButtonGroup
                        value={direction}
                        exclusive
                        onChange={(_, val) => val && setDirection(val)}
                        size="small"
                      >
                        <ToggleButton value="clockwise">Clockwise ↻</ToggleButton>
                        <ToggleButton value="counter-clockwise">Counter ↺</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={useAlternating}
                          onChange={(e) => setUseAlternating(e.target.checked)}
                        />
                      }
                      label="Alternating Pattern (odds/evens)"
                    />

                    <Typography variant="caption" color="text.secondary">
                      📌 Click on a seat to set Seat #1 position
                    </Typography>

                    <Typography variant="body2">
                      <strong>Pattern: </strong>
                      {useAlternating
                        ? `Alternating ${direction} (Seat 1 → Evens ${direction === 'clockwise' ? '→' : '←'} / Odds ${direction === 'clockwise' ? '←' : '→'})`
                        : `Simple ${direction} (1, 2, 3, ...)`
                      }
                    </Typography>
                  </Stack>
                </Paper>

                {/* Visual Preview */}
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
                      seatModes={seatModes}
                      startPosition={startPosition}
                      onSeatClick={handleSeatClick}
                      activeTab={activeTab}
                    />
                  ) : (
                    <RectangleTablePreview
                      top={tableConfig.rectangleSeats?.top || 0}
                      bottom={tableConfig.rectangleSeats?.bottom || 0}
                      left={tableConfig.rectangleSeats?.left || 0}
                      right={tableConfig.rectangleSeats?.right || 0}
                      seats={seatOrdering}
                      seatModes={seatModes}
                      startPosition={startPosition}
                      onSeatClick={handleSeatClick}
                      activeTab={activeTab}
                    />
                  )}
                </Box>

                {/* Full Sequence */}
                <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
                  <Typography variant="caption" color="text.secondary">
                    💡 <strong>Full Sequence:</strong> {seatOrdering.join(', ')}
                  </Typography>
                </Paper>
              </Stack>
            ) : (
              // Seat Modes Tab - NEW
              <Stack spacing={3} sx={{ height: '100%' }}>
                {/* Mode Controls */}
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                  <Stack spacing={2}>
                    <Typography variant="subtitle2">Quick Actions:</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => handleSetAllModes('default')}
                        startIcon={<RadioButtonUnchecked />}
                      >
                        All Default
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => handleSetAllModes('host-only')}
                        startIcon={<Person />}
                      >
                        All Host Only
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleSetAllModes('external-only')}
                        startIcon={<Public />}
                      >
                        All External Only
                      </Button>
                    </Stack>

                    <Divider />

                    <Typography variant="caption" color="text.secondary">
                      🎯 Click on a seat to set its mode. Modes restrict which guest types can be assigned.
                    </Typography>

                    <Stack direction="row" spacing={2}>
                      <Chip
                        size="small"
                        label={`Default: ${modeCounts['default']}`}
                        sx={{ bgcolor: SEAT_MODE_CONFIGS['default'].color }}
                      />
                      <Chip
                        size="small"
                        label={`Host Only: ${modeCounts['host-only']}`}
                        sx={{ bgcolor: SEAT_MODE_CONFIGS['host-only'].color, border: `2px solid ${SEAT_MODE_CONFIGS['host-only'].strokeColor}` }}
                      />
                      <Chip
                        size="small"
                        label={`External Only: ${modeCounts['external-only']}`}
                        sx={{ bgcolor: SEAT_MODE_CONFIGS['external-only'].color, border: `2px solid ${SEAT_MODE_CONFIGS['external-only'].strokeColor}` }}
                      />
                    </Stack>
                  </Stack>
                </Paper>

                {/* Visual Preview */}
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
                      seatModes={seatModes}
                      startPosition={startPosition}
                      onSeatClick={handleSeatClick}
                      activeTab={activeTab}
                    />
                  ) : (
                    <RectangleTablePreview
                      top={tableConfig.rectangleSeats?.top || 0}
                      bottom={tableConfig.rectangleSeats?.bottom || 0}
                      left={tableConfig.rectangleSeats?.left || 0}
                      right={tableConfig.rectangleSeats?.right || 0}
                      seats={seatOrdering}
                      seatModes={seatModes}
                      startPosition={startPosition}
                      onSeatClick={handleSeatClick}
                      activeTab={activeTab}
                    />
                  )}
                </Box>

                {/* Legend */}
                <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
                  <Stack direction="row" spacing={3}>
                    {Object.values(SEAT_MODE_CONFIGS).map((config) => (
                      <Stack key={config.mode} direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: config.color,
                            border: `2px ${config.mode === 'external-only' ? 'dashed' : 'solid'} ${config.strokeColor}`,
                          }}
                        />
                        <Typography variant="caption">{config.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Stack>
            )}
          </DialogContent>

        </>)}

      {topTab === 'suggested' && (
        <DialogContent sx={{ minHeight: 500 }}>
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">
              Suggested layouts coming soon.
            </Typography>
          </Box>
        </DialogContent>
      )}

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          Add Table(s)
        </Button>
      </DialogActions>

      {/* Seat Mode Selection Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuSelect('default')}>
          <ListItemIcon>
            <RadioButtonUnchecked fontSize="small" />
          </ListItemIcon>
          <ListItemText>Default (Any Guest)</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuSelect('host-only')}>
          <ListItemIcon>
            <Person fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>Host Only</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleMenuSelect('external-only')}>
          <ListItemIcon>
            <Public fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText>External Only</ListItemText>
        </MenuItem>
      </Menu>
    </Dialog>
  );
}

// --- Round Table Preview ---
interface RoundTablePreviewProps {
  seats: number[];
  seatModes: SeatMode[];
  startPosition: number;
  onSeatClick: (event: React.MouseEvent<SVGGElement>, index: number) => void;
  activeTab: TabValue;
}

function RoundTablePreview({ seats, seatModes, startPosition, onSeatClick, activeTab }: RoundTablePreviewProps) {
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
          const mode = seatModes[index] || 'default';
          const modeConfig = SEAT_MODE_CONFIGS[mode];

          return (
            <g
              key={index}
              onClick={(e) => onSeatClick(e as any, index)}
              style={{ cursor: 'pointer' }}
            >
              {/* Highlight ring for seat #1 (only in ordering tab) */}
              {isSeatOne && activeTab === 'ordering' && (
                <circle
                  cx={x}
                  cy={y}
                  r={seatRadius + 4}
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="3"
                />
              )}

              {/* Seat circle */}
              <circle
                cx={x}
                cy={y}
                r={seatRadius}
                fill={activeTab === 'modes' ? modeConfig.color : (isSeatOne ? '#4caf50' : '#90caf9')}
                stroke={activeTab === 'modes' ? modeConfig.strokeColor : (isSeatOne ? '#2e7d32' : '#1565c0')}
                strokeWidth={activeTab === 'modes' && mode !== 'default' ? 3 : 2}
                strokeDasharray={mode === 'external-only' ? '6,3' : 'none'}
              />

              {/* Seat number */}
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize={seatRadius * 0.7}
                fontWeight="bold"
                fill={activeTab === 'modes' ? '#333' : (isSeatOne ? 'white' : '#0d47a1')}
              >
                {seatNumber}
              </text>

              {/* Mode indicator badge (modes tab only) */}
              {activeTab === 'modes' && mode !== 'default' && (
                <>
                  <circle
                    cx={x + seatRadius - 5}
                    cy={y - seatRadius + 5}
                    r={8}
                    fill={modeConfig.strokeColor}
                  />
                  <text
                    x={x + seatRadius - 5}
                    y={y - seatRadius + 8}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="white"
                  >
                    {modeConfig.shortLabel}
                  </text>
                </>
              )}

              {/* Position indicator (ordering tab only) */}
              {activeTab === 'ordering' && (
                <text
                  x={x}
                  y={y + seatRadius * 2}
                  textAnchor="middle"
                  fontSize={seatRadius * 0.45}
                  fill="#666"
                >
                  P{index + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {activeTab === 'ordering' && (
        <Chip
          label={`Seat #1 at Position ${startPosition + 1}`}
          color="success"
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8 }}
        />
      )}
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
  seatModes: SeatMode[];
  startPosition: number;
  onSeatClick: (event: React.MouseEvent<SVGGElement>, index: number) => void;
  activeTab: TabValue;
}

function RectangleTablePreview({
  top,
  bottom,
  left,
  right,
  seats,
  seatModes,
  startPosition,
  onSeatClick,
  activeTab,
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
          const mode = seatModes[index] || 'default';
          const modeConfig = SEAT_MODE_CONFIGS[mode];

          return (
            <g
              key={index}
              onClick={(e) => onSeatClick(e as any, index)}
              style={{ cursor: 'pointer' }}
            >
              {/* Highlight ring for seat #1 (ordering tab only) */}
              {isSeatOne && activeTab === 'ordering' && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={seatRadius + 4}
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="3"
                />
              )}

              {/* Seat circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={seatRadius}
                fill={activeTab === 'modes' ? modeConfig.color : (isSeatOne ? '#4caf50' : '#90caf9')}
                stroke={activeTab === 'modes' ? modeConfig.strokeColor : (isSeatOne ? '#2e7d32' : '#1565c0')}
                strokeWidth={activeTab === 'modes' && mode !== 'default' ? 3 : 2}
                strokeDasharray={mode === 'external-only' ? '6,3' : 'none'}
              />

              {/* Seat number */}
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                fontSize={seatRadius * 0.65}
                fontWeight="bold"
                fill={activeTab === 'modes' ? '#333' : (isSeatOne ? 'white' : '#0d47a1')}
              >
                {seatNumber}
              </text>

              {/* Mode indicator badge (modes tab only) */}
              {activeTab === 'modes' && mode !== 'default' && (
                <>
                  <circle
                    cx={pos.x + seatRadius - 5}
                    cy={pos.y - seatRadius + 5}
                    r={8}
                    fill={modeConfig.strokeColor}
                  />
                  <text
                    x={pos.x + seatRadius - 5}
                    y={pos.y - seatRadius + 8}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="white"
                  >
                    {modeConfig.shortLabel}
                  </text>
                </>
              )}

              {/* Position indicator (ordering tab only) */}
              {activeTab === 'ordering' && (
                <text
                  x={pos.x}
                  y={pos.y + seatRadius * 1.8}
                  textAnchor="middle"
                  fontSize={seatRadius * 0.4}
                  fill="#666"
                >
                  P{index + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {activeTab === 'ordering' && (
        <Chip
          label={`Seat #1 at Position ${startPosition + 1}`}
          color="success"
          size="small"
          sx={{ position: 'absolute', top: 8, left: 8 }}
        />
      )}
    </Box>
  );
}