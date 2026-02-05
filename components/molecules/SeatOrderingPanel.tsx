// components/molecules/SeatOrderingPanel.tsx
// REUSABLE COMPONENT for seat ordering configuration
// Used by: AddTableModal, ModifyTableModal, CreateEditTemplateModal, TemplateCustomizationModal
// Features: Auto mode (pattern-based) and Manual mode (click-to-assign)
// 
// FIXED: Properly preserves user's ordering selections across tab switches
// - Uses `currentOrdering` prop to restore user's touched state on remount
// - Stores `originalOrdering` separately for Reset functionality
// - Only resets when Reset button clicked or resetKey changes

'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Stack,
  Typography,
  Box,
  Paper,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh,
  Undo,
  TouchApp,
  AutoMode,
  HelpOutline,
} from '@mui/icons-material';
import { SeatMode } from '@/types/Seat';
import { Direction, OrderingPattern } from '@/types/TemplateV2';
import { generateOrdering } from '@/utils/templateScalerV2';
import TablePreview from '../atoms/TablePreview';
import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';

// ============================================================================
// TYPES
// ============================================================================

export type OrderingMode = 'auto' | 'manual';

export interface SeatOrderingPanelProps {
  tableType: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: { top: number; bottom: number; left: number; right: number };

  // Original values for Reset functionality
  initialDirection?: Direction;
  initialPattern?: OrderingPattern;
  initialStartPosition?: number;
  initialOrdering?: number[];

  // NEW: Current ordering from parent state (persists across tab switches)
  // If provided and valid, this takes precedence over initial* props on mount
  currentOrdering?: number[];

  seatModes: SeatMode[];

  onOrderingChange: (ordering: number[]) => void;

  onOrderingConfigChange?: (config: {
    direction: Direction;
    pattern: OrderingPattern;
    startPosition: number;
    mode: OrderingMode;
  }) => void;

  previewSize?: 'small' | 'medium' | 'large';
  maxPreviewHeight?: number;
  showModeToggle?: boolean;

  resetKey?: number;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface PatternPreviewProps {
  seatOrdering: number[];
  maxShow?: number;
}

function PatternPreview({ seatOrdering, maxShow = 20 }: PatternPreviewProps) {
  return (
    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
      <Typography variant="subtitle2" gutterBottom>
        Seat Sequence:
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {seatOrdering.slice(0, maxShow).map((num, idx) => (
          <Chip
            key={idx}
            label={num}
            size="small"
            color={num === 1 ? 'success' : 'default'}
            sx={{ minWidth: 32 }}
          />
        ))}
        {seatOrdering.length > maxShow && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: 1, alignSelf: 'center' }}
          >
            ... and {seatOrdering.length - maxShow} more
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

interface ManualSequencePreviewProps {
  ordering: number[];
  totalSeats: number;
}

function ManualSequencePreview({ ordering, totalSeats }: ManualSequencePreviewProps) {
  const assignedCount = ordering.filter(n => n > 0).length;

  return (
    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
      <Typography variant="subtitle2" gutterBottom>
        Manual Sequence ({assignedCount}/{totalSeats}):
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {ordering.map((num, idx) => (
          <Chip
            key={idx}
            label={num > 0 ? num : '?'}
            size="small"
            color={num > 0 ? 'success' : 'default'}
            variant={num > 0 ? 'filled' : 'outlined'}
            sx={{ minWidth: 32 }}
          />
        ))}
      </Box>
    </Paper>
  );
}

// ============================================================================
// PATTERN DESCRIPTIONS
// ============================================================================

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
      return tableType === 'round'
        ? `Opposite: 1↔2 face each other, 3↔4, 5↔6...`
        : `Opposite: Seat pairs face across table`;
    default:
      return '';
  }
}

function getPatternTooltip(pattern: OrderingPattern): string {
  switch (pattern) {
    case 'sequential':
      return 'Seats are numbered sequentially around the table in the selected direction.';
    case 'alternating':
      return 'Seat 1 starts at the position, then even numbers go one direction and odd numbers go the other.';
    case 'opposite':
      return 'Paired seating: Seat 1 faces Seat 2, Seat 3 faces Seat 4, etc.';
    default:
      return '';
  }
}

// ============================================================================
// HELPER: Check if ordering is a valid manual ordering
// ============================================================================

function isValidManualOrdering(ordering: number[] | undefined, totalSeats: number): boolean {
  if (!ordering || ordering.length !== totalSeats) return false;
  // Check if all positions are assigned (no zeros except for incomplete manual)
  // and values are in valid range
  const hasAllAssigned = ordering.every(v => v >= 1 && v <= totalSeats);
  return hasAllAssigned;
}

// ============================================================================
// HELPER: Try to detect ordering configuration from an ordering array
// ============================================================================

function detectOrderingConfig(
  ordering: number[],
  totalSeats: number,
  tableType: 'round' | 'rectangle',
  rectangleSeats?: { top: number; bottom: number; left: number; right: number }
): { mode: OrderingMode; direction: Direction; pattern: OrderingPattern; startPosition: number; manualAssignments: Map<number, number> } | null {
  if (!ordering || ordering.length !== totalSeats) return null;

  // Try to match against known auto patterns
  const directions: Direction[] = ['clockwise', 'counter-clockwise'];
  const patterns: OrderingPattern[] = ['sequential', 'alternating', 'opposite'];

  for (const direction of directions) {
    for (const pattern of patterns) {
      for (let startPos = 0; startPos < totalSeats; startPos++) {
        const config = tableType === 'rectangle' ? rectangleSeats : undefined;
        const testOrdering = generateOrdering(totalSeats, direction, pattern, startPos, config);
        if (testOrdering.length === ordering.length && testOrdering.every((v, i) => v === ordering[i])) {
          return {
            mode: 'auto',
            direction,
            pattern,
            startPosition: startPos,
            manualAssignments: new Map(),
          };
        }
      }
    }
  }

  // No auto pattern matches - this is a manual ordering
  const manualMap = new Map<number, number>();
  ordering.forEach((seatNum, posIndex) => {
    if (seatNum > 0) {
      manualMap.set(posIndex, seatNum);
    }
  });

  return {
    mode: 'manual',
    direction: 'counter-clockwise',
    pattern: 'sequential',
    startPosition: 0,
    manualAssignments: manualMap,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SeatOrderingPanel({
  tableType,
  roundSeats = 8,
  rectangleSeats = { top: 2, bottom: 2, left: 1, right: 1 },
  initialDirection = 'counter-clockwise',
  initialPattern = 'sequential',
  initialStartPosition = 0,
  initialOrdering,
  currentOrdering,
  seatModes,
  onOrderingChange,
  onOrderingConfigChange,
  previewSize = 'large',
  maxPreviewHeight = 400,
  showModeToggle = true,
  resetKey = 0,
}: SeatOrderingPanelProps) {
  // ========================================================================
  // STATE
  // ========================================================================

  const [orderingMode, setOrderingMode] = useState<OrderingMode>('auto');

  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [orderingPattern, setOrderingPattern] = useState<OrderingPattern>(initialPattern);
  const [startPosition, setStartPosition] = useState<number>(initialStartPosition);

  const [manualAssignments, setManualAssignments] = useState<Map<number, number>>(new Map());
  const [nextManualNumber, setNextManualNumber] = useState<number>(1);
  const [manualHistory, setManualHistory] = useState<Map<number, number>[]>([]);

  // Track reset key to know when to fully reset
  const lastResetKeyRef = useRef(resetKey);
  
  // Track if we've initialized from currentOrdering
  const hasInitializedRef = useRef(false);
  
  // Track last emitted ordering to prevent loops
  const lastEmittedOrderingRef = useRef<number[] | null>(null);

  // Store the original ordering for reset functionality
  const originalOrderingRef = useRef<{
    direction: Direction;
    pattern: OrderingPattern;
    startPosition: number;
    ordering: number[];
  } | null>(null);

  // ========================================================================
  // COMPUTED
  // ========================================================================

  const totalSeats = useMemo(() => {
    return tableType === 'round'
      ? roundSeats
      : rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
  }, [tableType, roundSeats, rectangleSeats]);

  const autoOrdering = useMemo(() => {
    const config = tableType === 'rectangle' ? rectangleSeats : undefined;
    return generateOrdering(totalSeats, direction, orderingPattern, startPosition, config);
  }, [totalSeats, direction, orderingPattern, startPosition, tableType, rectangleSeats]);

  const manualOrdering = useMemo(() => {
    const ordering = new Array(totalSeats).fill(0);
    manualAssignments.forEach((seatNum, posIndex) => {
      if (posIndex < totalSeats) ordering[posIndex] = seatNum;
    });
    return ordering;
  }, [manualAssignments, totalSeats]);

  const displayOrdering = useMemo(
    () => (orderingMode === 'auto' ? autoOrdering : manualOrdering),
    [orderingMode, autoOrdering, manualOrdering]
  );

  const isManualComplete = useMemo(
    () => manualAssignments.size === totalSeats,
    [manualAssignments, totalSeats]
  );

  const patternDescription = getPatternDescription(orderingPattern, direction, tableType);

  // ========================================================================
  // EFFECTS
  // ========================================================================

  // Effect 1: Handle resetKey changes - full reset to original/initial values
  useEffect(() => {
    if (resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey;
      hasInitializedRef.current = false;
      lastEmittedOrderingRef.current = null;
      
      // Reset to initial values
      setDirection(initialDirection);
      setOrderingPattern(initialPattern);
      setStartPosition(initialStartPosition);
      setManualAssignments(new Map());
      setNextManualNumber(1);
      setManualHistory([]);
      setOrderingMode('auto');

      // Store the original ordering for reset button
      const config = tableType === 'rectangle' ? rectangleSeats : undefined;
      const originalOrdering = initialOrdering || generateOrdering(
        totalSeats, 
        initialDirection, 
        initialPattern, 
        initialStartPosition, 
        config
      );
      originalOrderingRef.current = {
        direction: initialDirection,
        pattern: initialPattern,
        startPosition: initialStartPosition,
        ordering: originalOrdering,
      };
    }
  }, [resetKey, initialDirection, initialPattern, initialStartPosition, initialOrdering, totalSeats, tableType, rectangleSeats]);

  // Effect 2: Initialize from currentOrdering on mount (preserves user's touched state)
  useEffect(() => {
    // Only run once per mount (or after reset)
    if (hasInitializedRef.current) return;
    
    // If we don't have a valid currentOrdering, try to initialize from initialOrdering (auto or manual)
    if (!currentOrdering || currentOrdering.length !== totalSeats) {
      // Try to apply initialOrdering if available
      if (initialOrdering && initialOrdering.length === totalSeats) {
        const detectedInit = detectOrderingConfig(initialOrdering, totalSeats, tableType, rectangleSeats);
        if (detectedInit) {
          setOrderingMode(detectedInit.mode);
          setDirection(detectedInit.direction);
          setOrderingPattern(detectedInit.pattern);
          setStartPosition(detectedInit.startPosition);
          if (detectedInit.mode === 'manual') {
            setManualAssignments(detectedInit.manualAssignments);
            setNextManualNumber(detectedInit.manualAssignments.size + 1);
          } else {
            setManualAssignments(new Map());
            setNextManualNumber(1);
          }
        }
      } else {
        // No initial/current ordering -> fall back to initial props
        setDirection(initialDirection);
        setOrderingPattern(initialPattern);
        setStartPosition(initialStartPosition);
        setOrderingMode('auto');
        setManualAssignments(new Map());
        setNextManualNumber(1);
        setManualHistory([]);
      }

      // Initialize original ordering ref if not set
      if (!originalOrderingRef.current) {
        const config = tableType === 'rectangle' ? rectangleSeats : undefined;
        const originalOrdering = initialOrdering || generateOrdering(
          totalSeats, 
          initialDirection, 
          initialPattern, 
          initialStartPosition, 
          config
        );
        originalOrderingRef.current = {
          direction: initialDirection,
          pattern: initialPattern,
          startPosition: initialStartPosition,
          ordering: originalOrdering,
        };
      }

      hasInitializedRef.current = true;
      return;
    }

    // We have a valid currentOrdering - try to detect its configuration
    const detected = detectOrderingConfig(currentOrdering, totalSeats, tableType, rectangleSeats);
    
    if (detected) {
      setOrderingMode(detected.mode);
      setDirection(detected.direction);
      setOrderingPattern(detected.pattern);
      setStartPosition(detected.startPosition);
      
      if (detected.mode === 'manual') {
        setManualAssignments(detected.manualAssignments);
        setNextManualNumber(detected.manualAssignments.size + 1);
      }
    }

    // Initialize original ordering ref if not set
    if (!originalOrderingRef.current) {
      const config = tableType === 'rectangle' ? rectangleSeats : undefined;
      const originalOrdering = initialOrdering || generateOrdering(
        totalSeats, 
        initialDirection, 
        initialPattern, 
        initialStartPosition, 
        config
      );
      originalOrderingRef.current = {
        direction: initialDirection,
        pattern: initialPattern,
        startPosition: initialStartPosition,
        ordering: originalOrdering,
      };
    }

    hasInitializedRef.current = true;
  }, [currentOrdering, totalSeats, tableType, rectangleSeats, initialDirection, initialPattern, initialStartPosition, initialOrdering]);
  
  // Effect 3: Reset start position if it exceeds seat count
  useEffect(() => {
    if (startPosition >= totalSeats) setStartPosition(0);
  }, [totalSeats, startPosition]);

  // Effect 4: Notify parent of ordering changes (idempotent)
  useEffect(() => {
    const prev = lastEmittedOrderingRef.current;

    const isSame =
      prev &&
      prev.length === displayOrdering.length &&
      prev.every((v, i) => v === displayOrdering[i]);

    if (isSame) return;

    lastEmittedOrderingRef.current = displayOrdering;
    onOrderingChange(displayOrdering);
  }, [displayOrdering, onOrderingChange]);

  // Effect 5: Notify parent of config changes
  useEffect(() => {
    onOrderingConfigChange?.({
      direction,
      pattern: orderingPattern,
      startPosition,
      mode: orderingMode,
    });
  }, [direction, orderingPattern, startPosition, orderingMode, onOrderingConfigChange]);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleModeChange = useCallback((newMode: OrderingMode) => {
    setOrderingMode(newMode);
    if (newMode === 'manual') {
      // Reset manual state when entering manual mode
      setManualAssignments(new Map());
      setNextManualNumber(1);
      setManualHistory([]);
    }
  }, []);

  const handleManualSeatClick = useCallback(
    (positionIndex: number) => {
      if (manualAssignments.has(positionIndex)) return;

      setManualHistory(prev => [...prev, new Map(manualAssignments)]);

      const newMap = new Map(manualAssignments);
      newMap.set(positionIndex, nextManualNumber);
      setManualAssignments(newMap);
      setNextManualNumber(prev => prev + 1);
    },
    [manualAssignments, nextManualNumber]
  );

  const handleManualUndo = useCallback(() => {
    if (manualHistory.length === 0) return;

    const prevState = manualHistory[manualHistory.length - 1];
    setManualHistory(prev => prev.slice(0, -1));
    setManualAssignments(prevState);
    setNextManualNumber(prev => Math.max(1, prev - 1));
  }, [manualHistory]);

  const handleManualReset = useCallback(() => {
    setManualHistory([]);
    setManualAssignments(new Map());
    setNextManualNumber(1);
  }, []);

  // Reset to original ordering (from template/initial props)
  const handleResetAll = useCallback(() => {
    if (originalOrderingRef.current) {
      setDirection(originalOrderingRef.current.direction);
      setOrderingPattern(originalOrderingRef.current.pattern);
      setStartPosition(originalOrderingRef.current.startPosition);
      setOrderingMode('auto');
      setManualAssignments(new Map());
      setNextManualNumber(1);
      setManualHistory([]);
    } else {
      // Fallback to initial props
      setDirection(initialDirection);
      setOrderingPattern(initialPattern);
      setStartPosition(initialStartPosition);
      setOrderingMode('auto');
      setManualAssignments(new Map());
      setNextManualNumber(1);
      setManualHistory([]);
    }
  }, [initialDirection, initialPattern, initialStartPosition]);

  const handleSeatClick = useCallback(
    (_: React.MouseEvent, index: number) => {
      orderingMode === 'auto' ? setStartPosition(index) : handleManualSeatClick(index);
    },
    [orderingMode, handleManualSeatClick]
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <Stack spacing={3}>
      {/* Mode Toggle + Controls */}
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
        <Stack spacing={2}>
          {/* Mode Toggle */}
          {showModeToggle && (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2">Ordering Mode:</Typography>
                <ToggleButtonGroup
                  value={orderingMode}
                  exclusive
                  onChange={(_, v) => v && handleModeChange(v)}
                  size="small"
                >
                  <ToggleButton value="auto">
                    <AutoMode sx={{ mr: 0.5 }} fontSize="small" />
                    Auto
                  </ToggleButton>
                  <ToggleButton value="manual">
                    <TouchApp sx={{ mr: 0.5 }} fontSize="small" />
                    Manual
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              
              <Button
                size="small"
                startIcon={<Refresh />}
                onClick={handleResetAll}
                variant="outlined"
              >
                Reset
              </Button>
            </Stack>
          )}

          {/* Auto Mode Controls */}
          {orderingMode === 'auto' && (
            <>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                {/* Direction */}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Direction:</Typography>
                  <ToggleButtonGroup
                    value={direction}
                    exclusive
                    onChange={(_, v) => v && setDirection(v)}
                    size="small"
                  >
                    <ToggleButton value="clockwise">Clockwise ↻</ToggleButton>
                    <ToggleButton value="counter-clockwise">Counter ↺</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                {/* Pattern */}
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Pattern</InputLabel>
                    <Select
                      value={orderingPattern}
                      label="Pattern"
                      onChange={(e) => setOrderingPattern(e.target.value as OrderingPattern)}
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
              </Stack>

              <Typography variant="body2">
                <strong>Pattern:</strong> {patternDescription}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                🎯 Click on a seat in the preview to set Seat #1 position
              </Typography>
            </>
          )}

          {/* Manual Mode Info */}
          {orderingMode === 'manual' && (
            <Typography variant="caption" color="text.secondary">
              🖱️ Click seats in the order you want them numbered (1, 2, 3, ...)
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* Manual Mode Progress */}
      {orderingMode === 'manual' && (
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0' }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={`${manualAssignments.size} / ${totalSeats} assigned`}
                color={isManualComplete ? 'success' : 'warning'}
                size="small"
              />
              {isManualComplete && (
                <Chip label="Complete!" color="success" size="small" variant="outlined" />
              )}
              {!isManualComplete && (
                <Typography variant="body2" color="text.secondary">
                  Click seat to assign #{nextManualNumber}
                </Typography>
              )}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Undo last assignment">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleManualUndo}
                    disabled={manualHistory.length === 0}
                  >
                    <Undo fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                size="small"
                startIcon={<Refresh />}
                onClick={handleManualReset}
                variant="outlined"
                disabled={manualAssignments.size === 0}
              >
                Clear All
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* Table Preview */}
      <ScrollablePreviewContainer maxHeight={maxPreviewHeight} minHeight={280}>
        <TablePreview
          type={tableType}
          roundSeats={roundSeats}
          rectangleSeats={rectangleSeats}
          seatOrdering={displayOrdering}
          seatModes={seatModes}
          startPosition={startPosition}
          onSeatClick={handleSeatClick}
          interactionMode={orderingMode === 'manual' ? 'manual-ordering' : 'ordering'}
          size={previewSize}
          showLabels
          manualAssignments={orderingMode === 'manual' ? manualAssignments : undefined}
          nextManualNumber={orderingMode === 'manual' ? nextManualNumber : undefined}
        />
      </ScrollablePreviewContainer>

      {/* Sequence Preview */}
      {orderingMode === 'auto' ? (
        <PatternPreview seatOrdering={displayOrdering} />
      ) : (
        <ManualSequencePreview ordering={displayOrdering} totalSeats={totalSeats} />
      )}
    </Stack>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PatternPreview, ManualSequencePreview };