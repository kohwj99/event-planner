// components/molecules/SeatModeControls.tsx
// Reusable component for configuring seat modes (default, host-only, external-only)
// Uses centralized color configuration from colorConfig.ts

'use client';

import {
  Stack,
  Typography,
  Paper,
  Button,
  Divider,
  Box,
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

// ============================================================================
// HELPER TO GET MODE COLORS FROM SCHEME
// ============================================================================

function getModeColorsFromScheme(mode: SeatMode, colorScheme: ColorScheme) {
  switch (mode) {
    case 'host-only':
      return {
        fill: colorScheme.seats.hostOnlyFill,
        stroke: colorScheme.seats.hostOnlyStroke,
        muiColor: 'primary' as const,
      };
    case 'external-only':
      return {
        fill: colorScheme.seats.externalOnlyFill,
        stroke: colorScheme.seats.externalOnlyStroke,
        muiColor: 'error' as const,
      };
    default:
      return {
        fill: colorScheme.seats.defaultFill,
        stroke: colorScheme.seats.defaultStroke,
        muiColor: 'success' as const,
      };
  }
}

// ============================================================================
// MAIN CONTROLS COMPONENT
// ============================================================================

interface SeatModeControlsProps {
  onSetAllModes: (mode: SeatMode) => void;
  onReset?: () => void;
  compact?: boolean;
  showResetButton?: boolean;
  modeCounts?: Record<SeatMode, number>;
}

export default function SeatModeControls({
  onSetAllModes,
  onReset,
  compact = false,
  showResetButton = true,
  modeCounts,
}: SeatModeControlsProps) {
  const colorScheme = useColorScheme();
  
  const defaultColors = getModeColorsFromScheme('default', colorScheme);
  const hostColors = getModeColorsFromScheme('host-only', colorScheme);
  const externalColors = getModeColorsFromScheme('external-only', colorScheme);

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: compact ? 1.5 : 2, 
        bgcolor: colorScheme.seats.defaultFill,
        border: `1px solid ${colorScheme.seats.defaultStroke}`,
        borderRadius: 2,
      }}
    >
      <Stack spacing={compact ? 1.5 : 2}>
        <Stack 
          direction="row" 
          spacing={2} 
          alignItems="center" 
          justifyContent="space-between"
        >
          <Typography variant={compact ? 'body2' : 'subtitle2'} fontWeight="bold">
            Quick Actions:
          </Typography>
          
          {showResetButton && onReset && (
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={onReset}
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
            onClick={() => onSetAllModes('default')}
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
            All Default
            {modeCounts && ` (${modeCounts['default']})`}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onSetAllModes('host-only')}
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
            All Host Only
            {modeCounts && ` (${modeCounts['host-only']})`}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onSetAllModes('external-only')}
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
            All External Only
            {modeCounts && ` (${modeCounts['external-only']})`}
          </Button>
        </Stack>

        <Divider />

        <Typography variant="caption" color="text.secondary">
          🎯 Click on a seat in the preview to set its mode. 
          Modes restrict which guest types can be assigned.
        </Typography>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// MODE LEGEND COMPONENT
// ============================================================================

interface SeatModeLegendProps {
  modeCounts?: Record<SeatMode, number>;
  compact?: boolean;
}

export function SeatModeLegend({ modeCounts, compact = false }: SeatModeLegendProps) {
  const colorScheme = useColorScheme();

  const modes: { mode: SeatMode; label: string }[] = [
    { mode: 'default', label: 'Default' },
    { mode: 'host-only', label: 'Host Only' },
    { mode: 'external-only', label: 'External Only' },
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
        {modes.map(({ mode, label }) => {
          const colors = getModeColorsFromScheme(mode, colorScheme);
          return (
            <Stack key={mode} direction="row" alignItems="center" spacing={0.5}>
              <Box
                sx={{
                  width: compact ? 12 : 16,
                  height: compact ? 12 : 16,
                  borderRadius: '50%',
                  bgcolor: colors.fill,
                  border: `2px ${mode === 'external-only' ? 'dashed' : 'solid'} ${colors.stroke}`,
                }}
              />
              <Typography variant="caption">
                {label}
                {modeCounts && ` (${modeCounts[mode]})`}
              </Typography>
            </Stack>
          );
        })}

        {/* Locked and Selected states */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: compact ? 12 : 16,
              height: compact ? 12 : 16,
              borderRadius: '50%',
              bgcolor: colorScheme.seats.lockedFill,
              border: `2px solid ${colorScheme.seats.lockedStroke}`,
            }}
          />
          <Typography variant="caption">Locked</Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: compact ? 12 : 16,
              height: compact ? 12 : 16,
              borderRadius: '50%',
              bgcolor: colorScheme.seats.selectedFill,
              border: `2px solid ${colorScheme.seats.selectedStroke}`,
            }}
          />
          <Typography variant="caption">Selected</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// MODE SELECTION MENU (for clicking on seats)
// ============================================================================

interface SeatModeMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (mode: SeatMode) => void;
  currentMode?: SeatMode;
}

export function SeatModeMenu({ 
  anchorEl, 
  onClose, 
  onSelect,
  currentMode = 'default',
}: SeatModeMenuProps) {
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
// PATTERN SELECTOR (for templates)
// ============================================================================

import { SeatModePattern, DEFAULT_MODE_PATTERNS } from '@/types/Template';

interface ModePatternSelectorProps {
  selectedPattern: string;
  onPatternChange: (patternKey: string, pattern: SeatModePattern) => void;
  compact?: boolean;
}

export function ModePatternSelector({
  selectedPattern,
  onPatternChange,
  compact = false,
}: ModePatternSelectorProps) {
  const colorScheme = useColorScheme();

  const patterns = [
    { key: 'allDefault', label: 'All Default', description: 'No restrictions' },
    { key: 'alternatingHostExternal', label: 'Alternating', description: 'Host/External alternating' },
    { key: 'hostOnlyFirst', label: 'VIP Host First', description: 'First seat for host VIP' },
    { key: 'externalOnlyFirst', label: 'VIP External First', description: 'First seat for external VIP' },
  ];

  return (
    <Stack spacing={1}>
      <Typography variant={compact ? 'body2' : 'subtitle2'} fontWeight="bold">
        Mode Pattern:
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {patterns.map((p) => (
          <Button
            key={p.key}
            size="small"
            variant={selectedPattern === p.key ? 'contained' : 'outlined'}
            onClick={() => onPatternChange(p.key, DEFAULT_MODE_PATTERNS[p.key])}
            sx={{ 
              textTransform: 'none',
              ...(selectedPattern === p.key && {
                bgcolor: colorScheme.ui.primary,
                '&:hover': {
                  bgcolor: colorScheme.ui.primary,
                },
              }),
            }}
          >
            {p.label}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}