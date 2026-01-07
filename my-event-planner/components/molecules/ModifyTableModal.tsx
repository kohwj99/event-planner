// components/molecules/ModifyTableModal.tsx
// Modal for modifying existing table
// REFACTORED: Uses SeatOrderingPanel and SeatModePanel reusable components
// Features: Full table configuration, ordering with auto/manual modes, seat modes
// FIXED: Passes currentOrdering to preserve user's selections across tab switches

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Slider,
  Divider,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { Refresh, Warning } from '@mui/icons-material';
import { Table } from '@/types/Table';
import { SeatMode } from '@/types/Seat';
import { createRoundTable, createRectangleTable } from '@/utils/generateTable';

// Reusable components
import TablePreview from '../atoms/TablePreview';
import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';
import SeatOrderingPanel from './SeatOrderingPanel';
import SeatModePanel from './SeatModePanel';

// ============================================================================
// TYPES
// ============================================================================

export interface ModifyTableConfig {
  type: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  label: string;
  seatOrdering?: number[];
  seatModes?: SeatMode[];
}

interface ModifyTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newTable: Table) => void;
  table: Table | null;
}

type TabValue = 'config' | 'ordering' | 'modes';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract rectangle seat counts from a table
 * Uses stored metadata if available, with improved fallback
 */
function extractRectangleSeats(table: Table): { top: number; bottom: number; left: number; right: number } {
  if (table.shape !== 'rectangle') {
    return { top: 2, bottom: 2, left: 1, right: 1 };
  }

  // Use stored metadata if available
  if (table.rectangleSeats) {
    return { ...table.rectangleSeats };
  }

  // Fallback: Extract from seat positions
  const width = table.width || 160;
  const height = table.height || 100;
  const centerX = table.x;
  const centerY = table.y;

  let top = 0, bottom = 0, left = 0, right = 0;

  const seatRadius = 12;
  const seatOffset = seatRadius * 2.5;
  const tolerance = seatOffset + 15;

  table.seats.forEach((seat) => {
    const relY = seat.y - centerY;
    const relX = seat.x - centerX;

    if (relY < -height / 2 + tolerance && relY < 0) {
      top++;
    } else if (relY > height / 2 - tolerance && relY > 0) {
      bottom++;
    } else if (relX < -width / 2 + tolerance && relX < 0) {
      left++;
    } else if (relX > width / 2 - tolerance && relX > 0) {
      right++;
    }
  });

  const total = top + bottom + left + right;
  if (total === 0 || total !== table.seats.length) {
    const seatCount = table.seats.length;
    const perSide = Math.floor(seatCount / 4);
    const remainder = seatCount % 4;
    return {
      top: perSide + (remainder > 0 ? 1 : 0),
      bottom: perSide + (remainder > 1 ? 1 : 0),
      left: perSide + (remainder > 2 ? 1 : 0),
      right: perSide,
    };
  }

  return { top, bottom, left, right };
}

/**
 * Extract seat modes from existing table
 */
function extractSeatModes(table: Table): SeatMode[] {
  return table.seats.map((seat) => seat.mode || 'default');
}

/**
 * Extract current ordering from table seats
 */
function extractCurrentOrdering(table: Table): number[] {
  return table.seats.map((seat) => seat.seatNumber);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ModifyTableModal({
  open,
  onClose,
  onConfirm,
  table,
}: ModifyTableModalProps) {
  // Active tab
  const [activeTab, setActiveTab] = useState<TabValue>('config');

  // Reset key for child components
  const [resetKey, setResetKey] = useState(0);

  // Table configuration
  const [tableConfig, setTableConfig] = useState<ModifyTableConfig>({
    type: 'round',
    roundSeats: 8,
    rectangleSeats: { top: 2, bottom: 2, left: 1, right: 1 },
    label: '',
  });

  // Ordering (managed by SeatOrderingPanel, stored here for final submission)
  const [seatOrdering, setSeatOrdering] = useState<number[]>([]);

  // Seat modes (managed by SeatModePanel)
  const [seatModes, setSeatModes] = useState<SeatMode[]>([]);

  // Initial ordering for edit mode (original from table, for Reset functionality)
  const [initialOrdering, setInitialOrdering] = useState<number[] | undefined>(undefined);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const totalSeats = useMemo(() => {
    if (tableConfig.type === 'round') {
      return tableConfig.roundSeats || 8;
    }
    const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
    return top + bottom + left + right;
  }, [tableConfig]);

  // Check if there are changes that would unseat guests
  const seatsChanged = useMemo(() => {
    if (!table) return false;
    return totalSeats !== table.seats.length || tableConfig.type !== table.shape;
  }, [table, totalSeats, tableConfig.type]);

  const seatedGuestsCount = useMemo(() => {
    if (!table) return 0;
    return table.seats.filter((s) => s.assignedGuestId).length;
  }, [table]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize from existing table when modal opens
  useEffect(() => {
    if (table && open) {
      // Initialize table config
      if (table.shape === 'round') {
        setTableConfig({
          type: 'round',
          roundSeats: table.seats.length,
          rectangleSeats: { top: 2, bottom: 2, left: 1, right: 1 },
          label: table.label,
        });
      } else {
        const extractedSeats = extractRectangleSeats(table);
        setTableConfig({
          type: 'rectangle',
          roundSeats: 8,
          rectangleSeats: extractedSeats,
          label: table.label,
        });
      }

      // Extract and set initial values
      const modes = extractSeatModes(table);
      const ordering = extractCurrentOrdering(table);

      setSeatModes(modes);
      setSeatOrdering(ordering);
      setInitialOrdering(ordering);

      setActiveTab('config');
      setResetKey(prev => prev + 1);
    }
  }, [table, open]);

  // Adjust seat modes when seat count changes
  useEffect(() => {
    setSeatModes((prev) => {
      if (prev.length === totalSeats) return prev;
      if (totalSeats > prev.length) {
        return [...prev, ...Array(totalSeats - prev.length).fill('default' as SeatMode)];
      }
      return prev.slice(0, totalSeats);
    });
  }, [totalSeats]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleOrderingChange = useCallback((ordering: number[]) => {
    setSeatOrdering(ordering);
  }, []);

  const handleModesChange = useCallback((modes: SeatMode[]) => {
    setSeatModes(modes);
  }, []);

  const handleConfirm = () => {
    if (!table) return;

    let newTable: Table;

    if (tableConfig.type === 'round') {
      newTable = createRoundTable(
        table.id,
        table.x,
        table.y,
        table.radius || 80,
        totalSeats,
        tableConfig.label || table.label,
        seatOrdering,
        seatModes
      );
    } else {
      const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
      newTable = createRectangleTable(
        table.id,
        table.x,
        table.y,
        top,
        bottom,
        left,
        right,
        tableConfig.label || table.label,
        seatOrdering,
        seatModes
      );
    }

    onConfirm(newTable);
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!table) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Modify Table: {table.label}</Typography>
        </Stack>
      </DialogTitle>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label="Table Configuration" value="config" />
        <Tab label="Seat Ordering" value="ordering" />
        <Tab label="Seat Modes" value="modes" />
      </Tabs>

      <DialogContent sx={{ minHeight: 500 }}>
        {/* Warning about unseating guests */}
        {seatsChanged && seatedGuestsCount > 0 && (
          <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
            Changing the table configuration will unseat <strong>{seatedGuestsCount}</strong> guest{seatedGuestsCount > 1 ? 's' : ''}.
          </Alert>
        )}

        {/* CONFIG TAB */}
        {activeTab === 'config' && (
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
                <MenuItem value="round">Round Table</MenuItem>
                <MenuItem value="rectangle">Rectangle Table</MenuItem>
              </Select>
            </FormControl>

            {tableConfig.type === 'round' ? (
              <Box>
                <Typography gutterBottom>
                  Number of Seats: {tableConfig.roundSeats}
                </Typography>
                <Slider
                  value={tableConfig.roundSeats || 8}
                  onChange={(_, val) =>
                    setTableConfig((prev) => ({ ...prev, roundSeats: val as number }))
                  }
                  min={4}
                  max={20}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>
            ) : (
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="text.secondary">
                  Seats per side:
                </Typography>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Top"
                    type="number"
                    value={tableConfig.rectangleSeats?.top || 0}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          top: Math.max(0, parseInt(e.target.value) || 0),
                        },
                      }))
                    }
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <TextField
                    label="Bottom"
                    type="number"
                    value={tableConfig.rectangleSeats?.bottom || 0}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          bottom: Math.max(0, parseInt(e.target.value) || 0),
                        },
                      }))
                    }
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <TextField
                    label="Left"
                    type="number"
                    value={tableConfig.rectangleSeats?.left || 0}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          left: Math.max(0, parseInt(e.target.value) || 0),
                        },
                      }))
                    }
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <TextField
                    label="Right"
                    type="number"
                    value={tableConfig.rectangleSeats?.right || 0}
                    onChange={(e) =>
                      setTableConfig((prev) => ({
                        ...prev,
                        rectangleSeats: {
                          ...prev.rectangleSeats!,
                          right: Math.max(0, parseInt(e.target.value) || 0),
                        },
                      }))
                    }
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                </Stack>
              </Stack>
            )}

            <Divider />

            <TextField
              label="Table Label"
              value={tableConfig.label}
              onChange={(e) =>
                setTableConfig((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder={table.label}
              fullWidth
            />

            {/* Preview */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa' }}>
              <Typography variant="subtitle2" gutterBottom>
                Preview ({totalSeats} seats)
              </Typography>
              <ScrollablePreviewContainer maxHeight={350} minHeight={250}>
                <TablePreview
                  type={tableConfig.type}
                  roundSeats={tableConfig.roundSeats}
                  rectangleSeats={tableConfig.rectangleSeats}
                  seatOrdering={seatOrdering}
                  seatModes={seatModes}
                  size="large"
                />
              </ScrollablePreviewContainer>
            </Paper>
          </Stack>
        )}

        {/* ORDERING TAB - Uses SeatOrderingPanel */}
        {activeTab === 'ordering' && (
          <Box sx={{ mt: 2 }}>
            <SeatOrderingPanel
              tableType={tableConfig.type}
              roundSeats={tableConfig.roundSeats}
              rectangleSeats={tableConfig.rectangleSeats}
              seatModes={seatModes}
              initialOrdering={initialOrdering}
              currentOrdering={seatOrdering.length === totalSeats ? seatOrdering : undefined}
              onOrderingChange={handleOrderingChange}
              previewSize="large"
              maxPreviewHeight={400}
              showModeToggle={true}
              resetKey={resetKey}
            />
          </Box>
        )}

        {/* MODES TAB - Uses SeatModePanel */}
        {activeTab === 'modes' && (
          <Box sx={{ mt: 2 }}>
            <SeatModePanel
              tableType={tableConfig.type}
              roundSeats={tableConfig.roundSeats}
              rectangleSeats={tableConfig.rectangleSeats}
              seatOrdering={seatOrdering}
              seatModes={seatModes}
              onModesChange={handleModesChange}
              previewSize="large"
              maxPreviewHeight={400}
              showResetButton={true}
              resetKey={resetKey}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={seatsChanged && seatedGuestsCount > 0 ? 'warning' : 'primary'}
        >
          {seatsChanged && seatedGuestsCount > 0 ? 'Apply Changes (Unseat Guests)' : 'Apply Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}