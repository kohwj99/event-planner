// components/molecules/SeatModeControls.tsx
// Reusable component for configuring seat modes (default, host-only, external-only)

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
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';

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
  return (
    <Paper elevation={0} sx={{ p: compact ? 1.5 : 2, bgcolor: '#e8f5e9' }}>
      <Stack spacing={compact ? 1.5 : 2}>
        <Stack 
          direction="row" 
          spacing={2} 
          alignItems="center" 
          justifyContent="space-between"
        >
          <Typography variant={compact ? 'body2' : 'subtitle2'}>Quick Actions:</Typography>
          
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

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            color="success"
            onClick={() => onSetAllModes('default')}
            startIcon={<RadioButtonUnchecked />}
          >
            All Default
            {modeCounts && ` (${modeCounts['default']})`}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => onSetAllModes('host-only')}
            startIcon={<Person />}
          >
            All Host Only
            {modeCounts && ` (${modeCounts['host-only']})`}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => onSetAllModes('external-only')}
            startIcon={<Public />}
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
  return (
    <Paper elevation={0} sx={{ p: compact ? 1 : 1.5, bgcolor: '#f5f5f5' }}>
      <Stack 
        direction="row" 
        spacing={compact ? 1.5 : 3} 
        alignItems="center" 
        justifyContent="center"
        flexWrap="wrap"
      >
        {Object.values(SEAT_MODE_CONFIGS).map((config) => (
          <Stack key={config.mode} direction="row" alignItems="center" spacing={0.5}>
            <Box
              sx={{
                width: compact ? 12 : 16,
                height: compact ? 12 : 16,
                borderRadius: '50%',
                bgcolor: config.color,
                border: `2px ${config.mode === 'external-only' ? 'dashed' : 'solid'} ${config.strokeColor}`,
              }}
            />
            <Typography variant="caption">
              {config.label}
              {modeCounts && ` (${modeCounts[config.mode]})`}
            </Typography>
          </Stack>
        ))}
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
  const handleSelect = (mode: SeatMode) => {
    onSelect(mode);
    onClose();
  };

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
          <RadioButtonUnchecked sx={{ color: SEAT_MODE_CONFIGS['default'].strokeColor }} />
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
          <Person sx={{ color: SEAT_MODE_CONFIGS['host-only'].strokeColor }} />
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
          <Public sx={{ color: SEAT_MODE_CONFIGS['external-only'].strokeColor }} />
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
  const patterns = [
    { key: 'allDefault', label: 'All Default', description: 'No restrictions' },
    { key: 'alternatingHostExternal', label: 'Alternating', description: 'Host/External alternating' },
    { key: 'hostOnlyFirst', label: 'VIP Host First', description: 'First seat for host VIP' },
    { key: 'externalOnlyFirst', label: 'VIP External First', description: 'First seat for external VIP' },
  ];

  return (
    <Stack spacing={1}>
      <Typography variant={compact ? 'body2' : 'subtitle2'}>Mode Pattern:</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {patterns.map((p) => (
          <Button
            key={p.key}
            size="small"
            variant={selectedPattern === p.key ? 'contained' : 'outlined'}
            onClick={() => onPatternChange(p.key, DEFAULT_MODE_PATTERNS[p.key])}
            sx={{ textTransform: 'none' }}
          >
            {p.label}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
}