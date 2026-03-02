// components/molecules/SeatModePanel.tsx
// REUSABLE COMPONENT for seat mode configuration
// Used by: AddTableModal, ModifyTableModal, CreateEditTemplateModal
// Features: Quick actions, click-to-change modes, legend

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Stack,
  Typography,
  Box,
  Paper,
  Button,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Refresh,
  Person,
  Public,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import { SeatMode } from '@/types/Seat';
import { useColorScheme } from '@/store/colorModeStore';
import { ColorScheme } from '@/utils/colorConfig';
import TablePreview from '../atoms/TablePreview';
import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';

// ============================================================================
// TYPES
// ============================================================================

export interface SeatModePanelProps {
  // Table configuration
  tableType: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: { top: number; bottom: number; left: number; right: number };
  
  // Seat ordering for display
  seatOrdering: number[];
  
  // Current modes (controlled)
  seatModes: SeatMode[];
  
  // Callback when modes change
  onModesChange: (modes: SeatMode[]) => void;
  
  // Display options
  previewSize?: 'small' | 'medium' | 'large';
  maxPreviewHeight?: number;
  showResetButton?: boolean;
  
  // Reset key - increment to reset internal state
  resetKey?: number;
}

// ============================================================================
// HELPER FUNCTION TO GET MODE COLORS
// ============================================================================

function getModeColorsFromScheme(mode: SeatMode, colorScheme: ColorScheme) {
  switch (mode) {
    case 'host-only':
      return {
        fill: colorScheme.seats.hostOnlyFill,
        stroke: colorScheme.seats.hostOnlyStroke,
      };
    case 'external-only':
      return {
        fill: colorScheme.seats.externalOnlyFill,
        stroke: colorScheme.seats.externalOnlyStroke,
      };
    default:
      return {
        fill: colorScheme.seats.defaultFill,
        stroke: colorScheme.seats.defaultStroke,
      };
  }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SeatModeLegendProps {
  modeCounts: Record<SeatMode, number>;
  compact?: boolean;
}

function SeatModeLegend({ modeCounts, compact = false }: SeatModeLegendProps) {
  const colorScheme = useColorScheme();

  const modes: { mode: SeatMode; label: string; strokeWidth: number; dashed?: boolean }[] = [
    { mode: 'default', label: 'Default', strokeWidth: 2 },
    { mode: 'host-only', label: 'Host Only', strokeWidth: 3.5 },
    { mode: 'external-only', label: 'External', strokeWidth: 2.5, dashed: true },
  ];

  return (
    <Paper elevation={0} sx={{ p: compact ? 1 : 1.5, bgcolor: '#f5f5f5', borderRadius: 1.5 }}>
      <Stack
        direction="row"
        spacing={compact ? 1.5 : 3}
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        useFlexGap
      >
        {modes.map(({ mode, label, strokeWidth, dashed }) => {
          const colors = getModeColorsFromScheme(mode, colorScheme);
          return (
            <Stack key={mode} direction="row" alignItems="center" spacing={0.5}>
              <Box
                sx={{
                  width: compact ? 14 : 18,
                  height: compact ? 14 : 18,
                  borderRadius: '50%',
                  bgcolor: '#ffffff',
                  border: `${strokeWidth}px ${dashed ? 'dashed' : 'solid'} ${colors.stroke}`,
                  boxSizing: 'border-box',
                }}
              />
              <Typography variant="caption">
                {label} ({modeCounts[mode]})
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

interface SeatModeMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (mode: SeatMode) => void;
  currentMode: SeatMode;
}

function SeatModeMenu({ anchorEl, onClose, onSelect, currentMode }: SeatModeMenuProps) {
  const colorScheme = useColorScheme();

  const handleSelect = (mode: SeatMode) => {
    onSelect(mode);
    onClose();
  };

  const defaultColors = getModeColorsFromScheme('default', colorScheme);
  const hostColors = getModeColorsFromScheme('host-only', colorScheme);
  const externalColors = getModeColorsFromScheme('external-only', colorScheme);

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <MenuItem
        onClick={() => handleSelect('default')}
        selected={currentMode === 'default'}
      >
        <ListItemIcon>
          <RadioButtonUnchecked sx={{ color: defaultColors.stroke }} />
        </ListItemIcon>
        <ListItemText
          primary="Default"
          secondary="Any guest can sit here"
        />
      </MenuItem>
      <MenuItem
        onClick={() => handleSelect('host-only')}
        selected={currentMode === 'host-only'}
      >
        <ListItemIcon>
          <Person sx={{ color: hostColors.stroke }} />
        </ListItemIcon>
        <ListItemText
          primary="Host Only"
          secondary="Only host company guests"
        />
      </MenuItem>
      <MenuItem
        onClick={() => handleSelect('external-only')}
        selected={currentMode === 'external-only'}
      >
        <ListItemIcon>
          <Public sx={{ color: externalColors.stroke }} />
        </ListItemIcon>
        <ListItemText
          primary="External Only"
          secondary="Only external guests"
        />
      </MenuItem>
    </Menu>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SeatModePanel({
  tableType,
  roundSeats = 8,
  rectangleSeats = { top: 2, bottom: 2, left: 1, right: 1 },
  seatOrdering,
  seatModes,
  onModesChange,
  previewSize = 'large',
  maxPreviewHeight = 400,
  showResetButton = true,
  resetKey = 0,
}: SeatModePanelProps) {
  const colorScheme = useColorScheme();
  
  // Menu state for seat mode selection
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const totalSeats = useMemo(() => {
    if (tableType === 'round') return roundSeats;
    return rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
  }, [tableType, roundSeats, rectangleSeats]);

  const modeCounts = useMemo(() => {
    const counts: Record<SeatMode, number> = {
      'default': 0,
      'host-only': 0,
      'external-only': 0,
    };
    seatModes.forEach((mode) => {
      counts[mode]++;
    });
    return counts;
  }, [seatModes]);

  // Get colors from scheme
  const defaultColors = getModeColorsFromScheme('default', colorScheme);
  const hostColors = getModeColorsFromScheme('host-only', colorScheme);
  const externalColors = getModeColorsFromScheme('external-only', colorScheme);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Reset menu state when resetKey changes
  useEffect(() => {
    setMenuAnchor(null);
    setSelectedSeatIndex(null);
  }, [resetKey]);

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleSeatModeChange = useCallback((index: number, mode: SeatMode) => {
    const newModes = [...seatModes];
    newModes[index] = mode;
    onModesChange(newModes);
  }, [seatModes, onModesChange]);

  const handleSetAllModes = useCallback((mode: SeatMode) => {
    const newModes = Array.from({ length: totalSeats }, () => mode);
    onModesChange(newModes);
  }, [totalSeats, onModesChange]);

  const handleResetModes = useCallback(() => {
    handleSetAllModes('default');
  }, [handleSetAllModes]);

  const handleSeatClick = useCallback((event: React.MouseEvent, index: number) => {
    setMenuAnchor(event.currentTarget as HTMLElement);
    setSelectedSeatIndex(index);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
    setSelectedSeatIndex(null);
  }, []);

  const handleMenuSelect = useCallback((mode: SeatMode) => {
    if (selectedSeatIndex !== null) {
      handleSeatModeChange(selectedSeatIndex, mode);
    }
    handleMenuClose();
  }, [selectedSeatIndex, handleSeatModeChange, handleMenuClose]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Stack spacing={3}>
      {/* Quick Actions */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: colorScheme.seats.defaultFill,
          border: `1px solid ${colorScheme.seats.defaultStroke}`,
          borderRadius: 2,
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" fontWeight="bold">
              Quick Actions:
            </Typography>
            {showResetButton && (
              <Button
                size="small"
                startIcon={<Refresh />}
                onClick={handleResetModes}
                variant="outlined"
              >
                Reset
              </Button>
            )}
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleSetAllModes('default')}
              startIcon={<RadioButtonUnchecked />}
              sx={{
                borderColor: defaultColors.stroke,
                color: defaultColors.stroke,
                '&:hover': {
                  borderColor: defaultColors.stroke,
                  bgcolor: defaultColors.fill,
                },
              }}
            >
              All Default ({modeCounts['default']})
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleSetAllModes('host-only')}
              startIcon={<Person />}
              sx={{
                borderColor: hostColors.stroke,
                color: hostColors.stroke,
                '&:hover': {
                  borderColor: hostColors.stroke,
                  bgcolor: hostColors.fill,
                },
              }}
            >
              All Host Only ({modeCounts['host-only']})
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleSetAllModes('external-only')}
              startIcon={<Public />}
              sx={{
                borderColor: externalColors.stroke,
                color: externalColors.stroke,
                '&:hover': {
                  borderColor: externalColors.stroke,
                  bgcolor: externalColors.fill,
                },
              }}
            >
              All External Only ({modeCounts['external-only']})
            </Button>
          </Stack>

          <Divider />

          <Typography variant="caption" color="text.secondary">
            🎯 Click on a seat in the preview to change its mode.
            Modes restrict which guest types can be assigned to each seat.
          </Typography>
        </Stack>
      </Paper>

      {/* Table Preview */}
      <ScrollablePreviewContainer maxHeight={maxPreviewHeight} minHeight={280}>
        <TablePreview
          type={tableType}
          roundSeats={roundSeats}
          rectangleSeats={rectangleSeats}
          seatOrdering={seatOrdering}
          seatModes={seatModes}
          onSeatClick={handleSeatClick}
          interactionMode="modes"
          size={previewSize}
          showLabels
        />
      </ScrollablePreviewContainer>

      {/* Mode Legend */}
      <SeatModeLegend modeCounts={modeCounts} />

      {/* Mode Selection Menu */}
      <SeatModeMenu
        anchorEl={menuAnchor}
        onClose={handleMenuClose}
        onSelect={handleMenuSelect}
        currentMode={selectedSeatIndex !== null ? seatModes[selectedSeatIndex] : 'default'}
      />
    </Stack>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { SeatModeLegend, SeatModeMenu };