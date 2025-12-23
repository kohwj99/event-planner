// components/molecules/SeatOrderingControls.tsx
// Reusable component for configuring seat ordering (direction, pattern, start position)

'use client';

import {
  Stack,
  Typography,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Switch,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Box,
} from '@mui/material';
import { Refresh, HelpOutline } from '@mui/icons-material';
import { Direction, OrderingPattern } from '@/types/Template';

interface SeatOrderingControlsProps {
  direction: Direction;
  orderingPattern: OrderingPattern;
  startPosition: number;
  totalSeats: number;
  onDirectionChange: (direction: Direction) => void;
  onPatternChange: (pattern: OrderingPattern) => void;
  onReset?: () => void;
  compact?: boolean;
  showResetButton?: boolean;
  showHelperText?: boolean;
  tableType?: 'round' | 'rectangle';
}

/**
 * Get pattern description for display
 */
function getPatternDescription(
  pattern: OrderingPattern,
  direction: Direction,
  tableType: 'round' | 'rectangle'
): string {
  switch (pattern) {
    case 'sequential':
      return `Simple ${direction} (1, 2, 3, ...)`;
    case 'alternating':
      return direction === 'clockwise'
        ? `Alternating: Seat 1 → Evens → / Odds ←`
        : `Alternating: Seat 1 → Evens ← / Odds →`;
    case 'opposite':
      if (tableType === 'round') {
        return `Opposite: 1↔2 face each other, 3↔4, 5↔6...`;
      }
      return `Opposite: Seat pairs face across table`;
    default:
      return '';
  }
}

/**
 * Get pattern tooltip explanation
 */
function getPatternTooltip(pattern: OrderingPattern): string {
  switch (pattern) {
    case 'sequential':
      return 'Seats are numbered sequentially around the table in the selected direction.';
    case 'alternating':
      return 'Seat 1 starts at the position, then even numbers go one direction and odd numbers go the other.';
    case 'opposite':
      return 'Paired seating: Seat 1 faces Seat 2, Seat 3 faces Seat 4, etc. Great for bilateral discussions where pairs should face each other.';
    default:
      return '';
  }
}

export default function SeatOrderingControls({
  direction,
  orderingPattern,
  startPosition,
  totalSeats,
  onDirectionChange,
  onPatternChange,
  onReset,
  compact = false,
  showResetButton = true,
  showHelperText = true,
  tableType = 'round',
}: SeatOrderingControlsProps) {
  const patternDescription = getPatternDescription(orderingPattern, direction, tableType);

  return (
    <Paper elevation={0} sx={{ p: compact ? 1.5 : 2, bgcolor: '#e3f2fd' }}>
      <Stack spacing={compact ? 1.5 : 2}>
        {/* Direction and Pattern Controls */}
        <Stack 
          direction={compact ? 'column' : 'row'} 
          spacing={2} 
          alignItems={compact ? 'flex-start' : 'center'}
          justifyContent="space-between"
          flexWrap="wrap"
        >
          {/* Direction */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant={compact ? 'body2' : 'subtitle2'}>Direction:</Typography>
            <ToggleButtonGroup
              value={direction}
              exclusive
              onChange={(_, val) => val && onDirectionChange(val)}
              size="small"
            >
              <ToggleButton value="clockwise">
                {compact ? '↻' : 'Clockwise ↻'}
              </ToggleButton>
              <ToggleButton value="counter-clockwise">
                {compact ? '↺' : 'Counter ↺'}
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {/* Pattern Selection */}
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: compact ? 120 : 150 }}>
              <InputLabel>Pattern</InputLabel>
              <Select
                value={orderingPattern}
                label="Pattern"
                onChange={(e) => onPatternChange(e.target.value as OrderingPattern)}
              >
                <MenuItem value="sequential">Sequential</MenuItem>
                <MenuItem value="alternating">Alternating</MenuItem>
                <MenuItem value="opposite">Opposite</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title={getPatternTooltip(orderingPattern)} arrow>
              <HelpOutline fontSize="small" color="action" sx={{ cursor: 'help' }} />
            </Tooltip>
          </Stack>

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

        {/* Helper Text */}
        {showHelperText && (
          <>
            <Typography variant="caption" color="text.secondary">
              📌 Click on a seat in the preview to set Seat #1 position
            </Typography>

            <Typography variant="body2">
              <strong>Pattern: </strong>
              {patternDescription}
            </Typography>

            {/* Opposite pattern special note */}
            {orderingPattern === 'opposite' && (
              <Box 
                sx={{ 
                  bgcolor: '#fff3e0', 
                  p: 1, 
                  borderRadius: 1,
                  border: '1px solid #ffb74d',
                }}
              >
                <Typography variant="caption" color="warning.dark">
                  💡 <strong>Opposite Pattern:</strong> Seat #1 will face Seat #2 across the table. 
                  Seat #3 is next to #1 (in direction), and faces #4, and so on.
                  {tableType === 'rectangle' && ' For rectangles, top↔bottom and left↔right are paired.'}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

// ============================================================================
// PATTERN PREVIEW HELPER
// ============================================================================

interface PatternPreviewProps {
  seatOrdering: number[];
  maxShow?: number;
}

export function PatternPreview({ seatOrdering, maxShow = 12 }: PatternPreviewProps) {
  const count = seatOrdering.length;
  const preview = seatOrdering.slice(0, maxShow).join(' → ');
  const fullPreview = count > maxShow ? `${preview} ...` : preview;

  return (
    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
      <Typography variant="caption" color="text.secondary">
        💡 <strong>Full Sequence:</strong> {seatOrdering.join(', ')}
      </Typography>
    </Paper>
  );
}