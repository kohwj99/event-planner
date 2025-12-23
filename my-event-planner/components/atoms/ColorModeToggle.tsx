// components/atoms/ColorModeToggle.tsx
// Toggle switch for colorblind mode with visual indicator

'use client';

import {
  Box,
  Switch,
  Stack,
  Typography,
  Tooltip,
  Paper,
  FormControlLabel,
  Chip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Accessibility,
} from '@mui/icons-material';
import { useColorModeStore, useColorScheme } from '@/store/colorModeStore';

// ============================================================================
// COMPACT TOGGLE (for toolbars)
// ============================================================================

interface ColorModeToggleProps {
  showLabel?: boolean;
  size?: 'small' | 'medium';
}

export default function ColorModeToggle({ 
  showLabel = true,
  size = 'medium',
}: ColorModeToggleProps) {
  const { colorMode, toggleColorMode } = useColorModeStore();
  const isColorblind = colorMode === 'colorblind';

  return (
    <Tooltip 
      title={isColorblind ? 'Switch to standard colors' : 'Switch to colorblind-friendly colors'}
      placement="bottom"
    >
      <FormControlLabel
        control={
          <Switch
            checked={isColorblind}
            onChange={toggleColorMode}
            size={size}
            color="primary"
            icon={<Visibility sx={{ fontSize: size === 'small' ? 16 : 20 }} />}
            checkedIcon={<Accessibility sx={{ fontSize: size === 'small' ? 16 : 20 }} />}
          />
        }
        label={showLabel ? (
          <Typography variant={size === 'small' ? 'caption' : 'body2'}>
            Colorblind Mode
          </Typography>
        ) : null}
        sx={{ mr: 0 }}
      />
    </Tooltip>
  );
}

// ============================================================================
// CHIP TOGGLE (for compact spaces)
// ============================================================================

export function ColorModeChip() {
  const { colorMode, toggleColorMode } = useColorModeStore();
  const isColorblind = colorMode === 'colorblind';

  return (
    <Chip
      icon={isColorblind ? <Accessibility /> : <Visibility />}
      label={isColorblind ? 'Colorblind' : 'Standard'}
      onClick={toggleColorMode}
      color={isColorblind ? 'primary' : 'default'}
      variant={isColorblind ? 'filled' : 'outlined'}
      size="small"
      sx={{ cursor: 'pointer' }}
    />
  );
}

// ============================================================================
// SETTINGS PANEL (for settings page)
// ============================================================================

export function ColorModeSettings() {
  const { colorMode, setColorMode } = useColorModeStore();
  const colorScheme = useColorScheme();

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Accessibility color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              Accessibility Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a color scheme that works best for you
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={2}>
          {/* Standard Mode Card */}
          <Paper
            elevation={colorMode === 'standard' ? 3 : 0}
            sx={{
              p: 2,
              flex: 1,
              cursor: 'pointer',
              border: '2px solid',
              borderColor: colorMode === 'standard' ? 'primary.main' : 'divider',
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'primary.light' },
            }}
            onClick={() => setColorMode('standard')}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Visibility color={colorMode === 'standard' ? 'primary' : 'action'} />
                <Typography variant="subtitle2" fontWeight="bold">
                  Standard Colors
                </Typography>
              </Stack>
              
              <Typography variant="caption" color="text.secondary">
                Default color scheme with rich colors
              </Typography>

              {/* Color preview */}
              <Stack direction="row" spacing={0.5}>
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#4caf50', border: '1px solid #388e3c' }} />
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#1976d2', border: '1px solid #0d47a1' }} />
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#d32f2f', border: '1px solid #b71c1c' }} />
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#ffc107', border: '1px solid #ffa000' }} />
              </Stack>
            </Stack>
          </Paper>

          {/* Colorblind Mode Card */}
          <Paper
            elevation={colorMode === 'colorblind' ? 3 : 0}
            sx={{
              p: 2,
              flex: 1,
              cursor: 'pointer',
              border: '2px solid',
              borderColor: colorMode === 'colorblind' ? 'primary.main' : 'divider',
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'primary.light' },
            }}
            onClick={() => setColorMode('colorblind')}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Accessibility color={colorMode === 'colorblind' ? 'primary' : 'action'} />
                <Typography variant="subtitle2" fontWeight="bold">
                  Colorblind Friendly
                </Typography>
              </Stack>
              
              <Typography variant="caption" color="text.secondary">
                Optimized for deuteranopia & protanopia
              </Typography>

              {/* Color preview */}
              <Stack direction="row" spacing={0.5}>
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#009688', border: '1px solid #00796b' }} />
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#0077bb', border: '1px solid #005588' }} />
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#ee7733', border: '1px solid #cc5500' }} />
                <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: '#f9a825', border: '1px solid #f57c00' }} />
              </Stack>
            </Stack>
          </Paper>
        </Stack>

        {/* Current color legend */}
        <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
          <Typography variant="caption" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
            Current Color Legend:
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <LegendItem 
              color={colorScheme.seats.defaultStroke} 
              label="Default Seat" 
            />
            <LegendItem 
              color={colorScheme.seats.hostOnlyStroke} 
              label="Host Only" 
            />
            <LegendItem 
              color={colorScheme.seats.externalOnlyStroke} 
              label="External Only" 
              dashed
            />
            <LegendItem 
              color={colorScheme.seats.selectedStroke} 
              label="Selected" 
            />
            <LegendItem 
              color={colorScheme.seats.lockedStroke} 
              label="Locked" 
            />
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// LEGEND ITEM HELPER
// ============================================================================

interface LegendItemProps {
  color: string;
  label: string;
  dashed?: boolean;
}

function LegendItem({ color, label, dashed = false }: LegendItemProps) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Box
        sx={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          bgcolor: color + '33', // 20% opacity
          border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }}
      />
      <Typography variant="caption">{label}</Typography>
    </Stack>
  );
}

// ============================================================================
// COLOR LEGEND FOR CANVAS (floating panel)
// ============================================================================

export function CanvasColorLegend() {
  const colorScheme = useColorScheme();
  const { colorMode, toggleColorMode } = useColorModeStore();

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 1.5, 
        borderRadius: 2,
        minWidth: 180,
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" fontWeight="bold">
            Color Legend
          </Typography>
          <ColorModeChip />
        </Stack>

        <Stack spacing={0.5}>
          {/* Seat modes */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Seat Modes:
          </Typography>
          <LegendItem 
            color={colorScheme.seats.defaultStroke} 
            label="Default (Any)" 
          />
          <LegendItem 
            color={colorScheme.seats.hostOnlyStroke} 
            label="Host Only" 
          />
          <LegendItem 
            color={colorScheme.seats.externalOnlyStroke} 
            label="External Only" 
            dashed
          />

          {/* Seat states */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Seat States:
          </Typography>
          <LegendItem 
            color={colorScheme.seats.assignedStroke} 
            label="Assigned" 
          />
          <LegendItem 
            color={colorScheme.seats.selectedStroke} 
            label="Selected" 
          />
          <LegendItem 
            color={colorScheme.seats.lockedStroke} 
            label="Locked" 
          />

          {/* Guest boxes */}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Guest Boxes:
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box
              sx={{
                width: 20,
                height: 12,
                borderRadius: 0.5,
                bgcolor: colorScheme.guestBox.hostFill,
                border: `1px solid ${colorScheme.guestBox.hostStroke}`,
              }}
            />
            <Typography variant="caption">Host Guest</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box
              sx={{
                width: 20,
                height: 12,
                borderRadius: 0.5,
                bgcolor: colorScheme.guestBox.externalFill,
                border: `1px solid ${colorScheme.guestBox.externalStroke}`,
              }}
            />
            <Typography variant="caption">External Guest</Typography>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}