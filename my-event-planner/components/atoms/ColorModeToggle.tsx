// components/atoms/ColorModeToggle.tsx
// Toggle switch for colorblind mode with hover legend popover

'use client';

import { useState, useRef } from 'react';
import {
  Box,
  Switch,
  Stack,
  Typography,
  Paper,
  FormControlLabel,
  Popper,
  Fade,
} from '@mui/material';
import {
  Visibility,
  Accessibility,
} from '@mui/icons-material';
import { useColorModeStore, useColorScheme } from '@/store/colorModeStore';
import { PALETTE_INFO, ColorScheme } from '@/utils/colorConfig';

// ============================================================================
// MAIN TOGGLE WITH HOVER LEGEND
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
  const colorScheme = useColorScheme();
  const isColorblind = colorMode === 'colorblind';
  
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAnchorEl(event.currentTarget);
    setShowLegend(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowLegend(false);
    }, 150);
  };

  const paletteInfo = isColorblind ? PALETTE_INFO.colorblind : PALETTE_INFO.standard;

  return (
    <Box 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Stack 
        direction="row" 
        spacing={1} 
        alignItems="center"
        sx={{ 
          cursor: 'pointer',
          py: 0.5,
          px: 1,
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Accessibility 
          fontSize={size === 'small' ? 'small' : 'medium'} 
          sx={{ 
            color: isColorblind ? colorScheme.ui.primary : 'text.secondary',
            transition: 'color 0.2s',
          }} 
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={isColorblind}
              onChange={toggleColorMode}
              size={size}
              color="primary"
            />
          }
          label={showLabel ? (
            <Typography variant={size === 'small' ? 'caption' : 'body2'} color="text.secondary">
              Colorblind
            </Typography>
          ) : null}
          sx={{ mr: 0, ml: 0 }}
        />
      </Stack>

      {/* Hover Legend Popover */}
      <Popper
        open={showLegend}
        anchorEl={anchorEl}
        placement="left-start"
        transition
        sx={{ zIndex: 1300 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper 
              elevation={4} 
              sx={{ 
                p: 2, 
                minWidth: 220,
                maxWidth: 280,
                mr: 1,
              }}
              onMouseEnter={() => {
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                }
              }}
              onMouseLeave={handleMouseLeave}
            >
              <Stack spacing={1.5}>
                {/* Header */}
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {paletteInfo.name} Mode
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {paletteInfo.description}
                  </Typography>
                </Box>

                {/* Seat Modes Legend - STROKE shows mode */}
                <Box>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Seat Modes (stroke = type)
                  </Typography>
                  <Stack spacing={0.5}>
                    <LegendRowWithWidth 
                      fill="#ffffff"
                      stroke={colorScheme.seats.defaultStroke}
                      strokeWidth={2}
                      label="Default (any guest)"
                    />
                    <LegendRowWithWidth 
                      fill="#ffffff"
                      stroke={colorScheme.seats.hostOnlyStroke}
                      strokeWidth={3.5}
                      label="Host Only (thick)"
                    />
                    <LegendRowWithWidth 
                      fill="#ffffff"
                      stroke={colorScheme.seats.externalOnlyStroke}
                      strokeWidth={2.5}
                      label="External Only (dashed)"
                      dashed
                    />
                  </Stack>
                </Box>

                {/* Seat States Legend - FILL shows state */}
                <Box>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Seat States (fill = status)
                  </Typography>
                  <Stack spacing={0.5}>
                    <LegendRowWithWidth 
                      fill="#ffffff"
                      stroke={colorScheme.seats.defaultStroke}
                      strokeWidth={2}
                      label="Empty (white)"
                    />
                    <AssignedLegendRow colorScheme={colorScheme} />
                    <LegendRowWithWidth 
                      fill={colorScheme.seats.selectedFill}
                      stroke={colorScheme.seats.selectedStroke}
                      strokeWidth={2}
                      label="Selected (yellow)"
                    />
                    <LegendRowWithWidth 
                      fill={colorScheme.seats.lockedFill}
                      stroke={colorScheme.seats.lockedStroke}
                      strokeWidth={2}
                      label="Locked (grey)"
                    />
                  </Stack>
                </Box>

                {/* Guest Boxes Legend */}
                <Box>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Guest Boxes
                  </Typography>
                  <Stack spacing={0.5}>
                    <LegendRow 
                      fill={colorScheme.guestBox.hostFill}
                      stroke={colorScheme.guestBox.hostStroke}
                      label="Host Guest"
                      isBox
                    />
                    <LegendRow 
                      fill={colorScheme.guestBox.externalFill}
                      stroke={colorScheme.guestBox.externalStroke}
                      label="External Guest"
                      isBox
                    />
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Fade>
        )}
      </Popper>
    </Box>
  );
}

// ============================================================================
// LEGEND ROW COMPONENT
// ============================================================================

interface LegendRowProps {
  fill: string;
  stroke: string;
  label: string;
  dashed?: boolean;
  isBox?: boolean;
}

function LegendRow({ fill, stroke, label, dashed = false, isBox = false }: LegendRowProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: isBox ? 24 : 16,
          height: isBox ? 14 : 16,
          borderRadius: isBox ? 0.5 : '50%',
          bgcolor: fill,
          border: `2px ${dashed ? 'dashed' : 'solid'} ${stroke}`,
          flexShrink: 0,
        }}
      />
      <Typography variant="caption" color="text.primary">
        {label}
      </Typography>
    </Stack>
  );
}

// Legend row with configurable stroke width to show mode differences
interface LegendRowWithWidthProps {
  fill: string;
  stroke: string;
  strokeWidth: number;
  label: string;
  dashed?: boolean;
}

function LegendRowWithWidth({ fill, stroke, strokeWidth, label, dashed = false }: LegendRowWithWidthProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        sx={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          bgcolor: fill,
          border: `${strokeWidth}px ${dashed ? 'dashed' : 'solid'} ${stroke}`,
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      />
      <Typography variant="caption" color="text.primary">
        {label}
      </Typography>
    </Stack>
  );
}

// Special component to show assigned seats have colored fills matching mode
interface AssignedLegendRowProps {
  colorScheme: ColorScheme;
}

function AssignedLegendRow({ colorScheme }: AssignedLegendRowProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Stack direction="row" spacing={0.25}>
        {/* Assigned default: green fill + green stroke */}
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: colorScheme.seats.defaultFill,
            border: `2px solid ${colorScheme.seats.defaultStroke}`,
          }}
        />
        {/* Assigned host-only: blue fill + blue thick stroke */}
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: colorScheme.seats.hostOnlyFill,
            border: `3px solid ${colorScheme.seats.hostOnlyStroke}`,
          }}
        />
        {/* Assigned external-only: red fill + red dashed stroke */}
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: colorScheme.seats.externalOnlyFill,
            border: `2.5px dashed ${colorScheme.seats.externalOnlyStroke}`,
          }}
        />
      </Stack>
      <Typography variant="caption" color="text.primary">
        Assigned (colored fill)
      </Typography>
    </Stack>
  );
}

// ============================================================================
// COMPACT TOGGLE (no label, minimal)
// ============================================================================

export function CompactColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorModeStore();
  const colorScheme = useColorScheme();
  const isColorblind = colorMode === 'colorblind';
  
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setAnchorEl(event.currentTarget);
    setShowLegend(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setShowLegend(false), 150);
  };

  const paletteInfo = isColorblind ? PALETTE_INFO.colorblind : PALETTE_INFO.standard;

  return (
    <Box onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Stack 
        direction="row" 
        spacing={0.5} 
        alignItems="center"
        onClick={toggleColorMode}
        sx={{ 
          cursor: 'pointer',
          py: 0.5,
          px: 1,
          borderRadius: 1,
          bgcolor: isColorblind ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Accessibility 
          fontSize="small" 
          sx={{ 
            color: isColorblind ? colorScheme.ui.primary : 'text.disabled',
          }} 
        />
        <Typography variant="caption" color={isColorblind ? 'primary' : 'text.secondary'}>
          {isColorblind ? 'CB' : 'Std'}
        </Typography>
      </Stack>

      {/* Hover Legend Popover */}
      <Popper
        open={showLegend}
        anchorEl={anchorEl}
        placement="left"
        transition
        sx={{ zIndex: 1300 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper 
              elevation={4} 
              sx={{ p: 1.5, minWidth: 200, mr: 1 }}
              onMouseEnter={() => timeoutRef.current && clearTimeout(timeoutRef.current)}
              onMouseLeave={handleMouseLeave}
            >
              <Typography variant="caption" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
                {paletteInfo.name}: {paletteInfo.description}
              </Typography>
              <Stack spacing={0.5}>
                <LegendRow 
                  fill={colorScheme.seats.defaultFill}
                  stroke={colorScheme.seats.defaultStroke}
                  label="Default"
                />
                <LegendRow 
                  fill={colorScheme.seats.hostOnlyFill}
                  stroke={colorScheme.seats.hostOnlyStroke}
                  label="Host Only"
                />
                <LegendRow 
                  fill={colorScheme.seats.externalOnlyFill}
                  stroke={colorScheme.seats.externalOnlyStroke}
                  label="External Only"
                  dashed
                />
              </Stack>
            </Paper>
          </Fade>
        )}
      </Popper>
    </Box>
  );
}