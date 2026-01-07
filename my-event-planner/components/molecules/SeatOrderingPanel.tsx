// // components/molecules/SeatOrderingPanel.tsx
// // REUSABLE COMPONENT for seat ordering configuration
// // Used by: AddTableModal, ModifyTableModal, CreateEditTemplateModal, TemplateCustomizationModal
// // Features: Auto mode (pattern-based) and Manual mode (click-to-assign)
// // FIXED: Properly initializes from template pattern without triggering false changes

// 'use client';

// import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
// import {
//   Stack,
//   Typography,
//   Box,
//   Paper,
//   Chip,
//   ToggleButtonGroup,
//   ToggleButton,
//   FormControl,
//   InputLabel,
//   Select,
//   MenuItem,
//   Button,
//   IconButton,
//   Tooltip,
// } from '@mui/material';
// import {
//   Refresh,
//   Undo,
//   TouchApp,
//   AutoMode,
//   HelpOutline,
// } from '@mui/icons-material';
// import { SeatMode } from '@/types/Seat';
// import { Direction, OrderingPattern } from '@/types/TemplateV2';
// import { generateOrdering } from '@/utils/templateScalerV2';
// import TablePreview from '../atoms/TablePreview';
// import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';

// // ============================================================================
// // TYPES
// // ============================================================================

// export type OrderingMode = 'auto' | 'manual';

// export interface SeatOrderingPanelProps {
//   // Table configuration
//   tableType: 'round' | 'rectangle';
//   roundSeats?: number;
//   rectangleSeats?: { top: number; bottom: number; left: number; right: number };
  
//   // Current values (controlled or initial)
//   initialDirection?: Direction;
//   initialPattern?: OrderingPattern;
//   initialStartPosition?: number;
//   initialOrdering?: number[];
  
//   // Seat modes for display
//   seatModes: SeatMode[];
  
//   // Callback when ordering changes
//   onOrderingChange: (ordering: number[]) => void;
  
//   // Optional: expose ordering config for templates
//   onOrderingConfigChange?: (config: {
//     direction: Direction;
//     pattern: OrderingPattern;
//     startPosition: number;
//     mode: OrderingMode;
//   }) => void;
  
//   // Display options
//   previewSize?: 'small' | 'medium' | 'large';
//   maxPreviewHeight?: number;
//   showModeToggle?: boolean;
  
//   // Reset key - increment to reset internal state
//   resetKey?: number;
// }

// // ============================================================================
// // HELPER COMPONENTS
// // ============================================================================

// interface PatternPreviewProps {
//   seatOrdering: number[];
//   maxShow?: number;
// }

// function PatternPreview({ seatOrdering, maxShow = 20 }: PatternPreviewProps) {
//   return (
//     <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
//       <Typography variant="subtitle2" gutterBottom>
//         Seat Sequence:
//       </Typography>
//       <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
//         {seatOrdering.slice(0, maxShow).map((num, idx) => (
//           <Chip
//             key={idx}
//             label={num}
//             size="small"
//             color={num === 1 ? 'success' : 'default'}
//             sx={{ minWidth: 32 }}
//           />
//         ))}
//         {seatOrdering.length > maxShow && (
//           <Typography variant="caption" color="text.secondary" sx={{ ml: 1, alignSelf: 'center' }}>
//             ... and {seatOrdering.length - maxShow} more
//           </Typography>
//         )}
//       </Box>
//     </Paper>
//   );
// }

// interface ManualSequencePreviewProps {
//   ordering: number[];
//   totalSeats: number;
// }

// function ManualSequencePreview({ ordering, totalSeats }: ManualSequencePreviewProps) {
//   const assignedCount = ordering.filter(n => n > 0).length;
  
//   return (
//     <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
//       <Typography variant="subtitle2" gutterBottom>
//         Manual Sequence ({assignedCount}/{totalSeats}):
//       </Typography>
//       <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
//         {ordering.map((num, idx) => (
//           <Chip
//             key={idx}
//             label={num > 0 ? num : '?'}
//             size="small"
//             color={num > 0 ? 'success' : 'default'}
//             variant={num > 0 ? 'filled' : 'outlined'}
//             sx={{ minWidth: 32 }}
//           />
//         ))}
//       </Box>
//     </Paper>
//   );
// }

// // ============================================================================
// // PATTERN DESCRIPTIONS
// // ============================================================================

// function getPatternDescription(
//   pattern: OrderingPattern,
//   direction: Direction,
//   tableType: 'round' | 'rectangle'
// ): string {
//   switch (pattern) {
//     case 'sequential':
//       return `Simple ${direction} (1, 2, 3, ...)`;
//     case 'alternating':
//       return direction === 'clockwise'
//         ? `Alternating: Seat 1 → Evens → / Odds ←`
//         : `Alternating: Seat 1 → Evens ← / Odds →`;
//     case 'opposite':
//       if (tableType === 'round') {
//         return `Opposite: 1↔2 face each other, 3↔4, 5↔6...`;
//       }
//       return `Opposite: Seat pairs face across table`;
//     default:
//       return '';
//   }
// }

// function getPatternTooltip(pattern: OrderingPattern): string {
//   switch (pattern) {
//     case 'sequential':
//       return 'Seats are numbered sequentially around the table in the selected direction.';
//     case 'alternating':
//       return 'Seat 1 starts at the position, then even numbers go one direction and odd numbers go the other.';
//     case 'opposite':
//       return 'Paired seating: Seat 1 faces Seat 2, Seat 3 faces Seat 4, etc. Great for bilateral discussions.';
//     default:
//       return '';
//   }
// }

// // ============================================================================
// // MAIN COMPONENT
// // ============================================================================

// export default function SeatOrderingPanel({
//   tableType,
//   roundSeats = 8,
//   rectangleSeats = { top: 2, bottom: 2, left: 1, right: 1 },
//   initialDirection = 'counter-clockwise',
//   initialPattern = 'sequential',
//   initialStartPosition = 0,
//   initialOrdering,
//   seatModes,
//   onOrderingChange,
//   onOrderingConfigChange,
//   previewSize = 'large',
//   maxPreviewHeight = 400,
//   showModeToggle = true,
//   resetKey = 0,
// }: SeatOrderingPanelProps) {
//   // ============================================================================
//   // STATE
//   // ============================================================================
  
//   // Ordering mode
//   const [orderingMode, setOrderingMode] = useState<OrderingMode>('auto');
  
//   // Auto mode state
//   const [direction, setDirection] = useState<Direction>(initialDirection);
//   const [orderingPattern, setOrderingPattern] = useState<OrderingPattern>(initialPattern);
//   const [startPosition, setStartPosition] = useState<number>(initialStartPosition);
  
//   // Manual mode state
//   const [manualAssignments, setManualAssignments] = useState<Map<number, number>>(new Map());
//   const [nextManualNumber, setNextManualNumber] = useState<number>(1);
//   const [manualHistory, setManualHistory] = useState<Map<number, number>[]>([]);
  
//   // Track if this is the initial render after reset to suppress callbacks
//   const isInitialRenderRef = useRef(true);
//   const lastResetKeyRef = useRef(resetKey);

//   // ============================================================================
//   // COMPUTED VALUES
//   // ============================================================================
  
//   const totalSeats = useMemo(() => {
//     if (tableType === 'round') return roundSeats;
//     return rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
//   }, [tableType, roundSeats, rectangleSeats]);

//   // Auto ordering (pattern-based)
//   const autoOrdering = useMemo(() => {
//     const config = tableType === 'rectangle' ? rectangleSeats : undefined;
//     return generateOrdering(totalSeats, direction, orderingPattern, startPosition, config);
//   }, [totalSeats, direction, orderingPattern, startPosition, tableType, rectangleSeats]);

//   // Manual ordering (from assignments map)
//   const manualOrdering = useMemo(() => {
//     const ordering = new Array(totalSeats).fill(0);
//     manualAssignments.forEach((seatNum, posIndex) => {
//       if (posIndex < totalSeats) {
//         ordering[posIndex] = seatNum;
//       }
//     });
//     return ordering;
//   }, [manualAssignments, totalSeats]);

//   // Current ordering based on mode
//   const currentOrdering = useMemo(() => {
//     return orderingMode === 'auto' ? autoOrdering : manualOrdering;
//   }, [orderingMode, autoOrdering, manualOrdering]);

//   // Manual mode completion status
//   const isManualComplete = useMemo(() => {
//     return manualAssignments.size === totalSeats;
//   }, [manualAssignments, totalSeats]);

//   const patternDescription = getPatternDescription(orderingPattern, direction, tableType);

//   // ============================================================================
//   // EFFECTS
//   // ============================================================================
  
//   // Reset state when resetKey changes
//   useEffect(() => {
//     if (resetKey !== lastResetKeyRef.current) {
//       lastResetKeyRef.current = resetKey;
//       isInitialRenderRef.current = true;
      
//       setDirection(initialDirection);
//       setOrderingPattern(initialPattern);
//       setStartPosition(initialStartPosition);
//       setManualAssignments(new Map());
//       setNextManualNumber(1);
//       setManualHistory([]);
//       setOrderingMode('auto');
//     }
//   }, [resetKey, initialDirection, initialPattern, initialStartPosition]);

//   // Initialize from initial ordering if provided (for edit mode)
//   // This effect determines if we should be in manual mode based on whether
//   // the initialOrdering matches what auto mode would generate
//   useEffect(() => {
//     if (!initialOrdering || initialOrdering.length !== totalSeats) return;
//     if (!isInitialRenderRef.current) return; // Only run on initial render
    
//     // Check if it matches a known pattern or is custom
//     const testAuto = generateOrdering(
//       totalSeats, 
//       initialDirection, 
//       initialPattern, 
//       initialStartPosition, 
//       tableType === 'rectangle' ? rectangleSeats : undefined
//     );
    
//     const matches = initialOrdering.every((v, i) => v === testAuto[i]);
    
//     if (!matches) {
//       // It's a custom ordering, switch to manual mode
//       setOrderingMode('manual');
//       const map = new Map<number, number>();
//       initialOrdering.forEach((seatNum, posIndex) => {
//         map.set(posIndex, seatNum);
//       });
//       setManualAssignments(map);
//       setNextManualNumber(totalSeats + 1);
//     }
//   }, [initialOrdering, totalSeats, initialDirection, initialPattern, initialStartPosition, tableType, rectangleSeats]);

//   // Reset manual assignments when seat count changes (but not on initial render)
//   useEffect(() => {
//     if (isInitialRenderRef.current) return;
    
//     if (orderingMode === 'manual') {
//       setManualAssignments(new Map());
//       setNextManualNumber(1);
//       setManualHistory([]);
//     }
//   }, [totalSeats]);

//   // Reset start position if it exceeds seat count
//   useEffect(() => {
//     if (startPosition >= totalSeats) {
//       setStartPosition(0);
//     }
//   }, [totalSeats, startPosition]);

//   // Notify parent of ordering changes (but skip initial render after reset)
//   useEffect(() => {
//     if (isInitialRenderRef.current) {
//       // On initial render, still call the callback but mark that we're done with initial render
//       // Use a small delay to ensure all state is settled
//       const timer = setTimeout(() => {
//         isInitialRenderRef.current = false;
//       }, 0);
      
//       // Still notify parent of the current ordering
//       onOrderingChange(currentOrdering);
//       return () => clearTimeout(timer);
//     }
    
//     onOrderingChange(currentOrdering);
//   }, [currentOrdering, onOrderingChange]);

//   // Notify parent of config changes
//   useEffect(() => {
//     if (onOrderingConfigChange) {
//       onOrderingConfigChange({
//         direction,
//         pattern: orderingPattern,
//         startPosition,
//         mode: orderingMode,
//       });
//     }
//   }, [direction, orderingPattern, startPosition, orderingMode, onOrderingConfigChange]);

//   // ============================================================================
//   // HANDLERS
//   // ============================================================================
  
//   const handleModeChange = useCallback((newMode: OrderingMode) => {
//     setOrderingMode(newMode);
//     if (newMode === 'manual') {
//       // Reset manual state when entering manual mode
//       setManualAssignments(new Map());
//       setNextManualNumber(1);
//       setManualHistory([]);
//     }
//   }, []);

//   const handleManualSeatClick = useCallback((positionIndex: number) => {
//     if (manualAssignments.has(positionIndex)) {
//       return; // Already assigned
//     }

//     // Save history for undo
//     setManualHistory((prev) => [...prev, new Map(manualAssignments)]);

//     // Assign the next seat number to this position
//     const newMap = new Map(manualAssignments);
//     newMap.set(positionIndex, nextManualNumber);
//     setManualAssignments(newMap);
//     setNextManualNumber((prev) => prev + 1);
//   }, [manualAssignments, nextManualNumber]);

//   const handleManualUndo = useCallback(() => {
//     if (manualHistory.length === 0) return;

//     const prevState = manualHistory[manualHistory.length - 1];
//     setManualHistory((prev) => prev.slice(0, -1));
//     setManualAssignments(prevState);
//     setNextManualNumber((prev) => Math.max(1, prev - 1));
//   }, [manualHistory]);

//   const handleManualReset = useCallback(() => {
//     setManualHistory([]);
//     setManualAssignments(new Map());
//     setNextManualNumber(1);
//   }, []);

//   const handleResetAll = useCallback(() => {
//     setDirection(initialDirection);
//     setOrderingPattern(initialPattern);
//     setStartPosition(initialStartPosition);
//     if (orderingMode === 'manual') {
//       handleManualReset();
//     }
//   }, [orderingMode, handleManualReset, initialDirection, initialPattern, initialStartPosition]);

//   const handleSeatClick = useCallback((event: React.MouseEvent, index: number) => {
//     if (orderingMode === 'auto') {
//       setStartPosition(index);
//     } else {
//       handleManualSeatClick(index);
//     }
//   }, [orderingMode, handleManualSeatClick]);

//   // ============================================================================
//   // RENDER
//   // ============================================================================

//   return (
//     <Stack spacing={3}>
//       {/* Mode Toggle + Controls */}
//       <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
//         <Stack spacing={2}>
//           {/* Mode Toggle */}
//           {showModeToggle && (
//             <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
//               <Stack direction="row" spacing={1} alignItems="center">
//                 <Typography variant="subtitle2">Ordering Mode:</Typography>
//                 <ToggleButtonGroup
//                   value={orderingMode}
//                   exclusive
//                   onChange={(_, v) => v && handleModeChange(v)}
//                   size="small"
//                 >
//                   <ToggleButton value="auto">
//                     <AutoMode sx={{ mr: 0.5 }} fontSize="small" />
//                     Auto
//                   </ToggleButton>
//                   <ToggleButton value="manual">
//                     <TouchApp sx={{ mr: 0.5 }} fontSize="small" />
//                     Manual
//                   </ToggleButton>
//                 </ToggleButtonGroup>
//               </Stack>
              
//               <Button
//                 size="small"
//                 startIcon={<Refresh />}
//                 onClick={handleResetAll}
//                 variant="outlined"
//               >
//                 Reset
//               </Button>
//             </Stack>
//           )}

//           {/* Auto Mode Controls */}
//           {orderingMode === 'auto' && (
//             <>
//               <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
//                 {/* Direction */}
//                 <Stack direction="row" spacing={1} alignItems="center">
//                   <Typography variant="body2">Direction:</Typography>
//                   <ToggleButtonGroup
//                     value={direction}
//                     exclusive
//                     onChange={(_, v) => v && setDirection(v)}
//                     size="small"
//                   >
//                     <ToggleButton value="clockwise">Clockwise ↻</ToggleButton>
//                     <ToggleButton value="counter-clockwise">Counter ↺</ToggleButton>
//                   </ToggleButtonGroup>
//                 </Stack>

//                 {/* Pattern */}
//                 <Stack direction="row" spacing={1} alignItems="center">
//                   <FormControl size="small" sx={{ minWidth: 150 }}>
//                     <InputLabel>Pattern</InputLabel>
//                     <Select
//                       value={orderingPattern}
//                       label="Pattern"
//                       onChange={(e) => setOrderingPattern(e.target.value as OrderingPattern)}
//                     >
//                       <MenuItem value="sequential">Sequential</MenuItem>
//                       <MenuItem value="alternating">Alternating</MenuItem>
//                       <MenuItem value="opposite">Opposite</MenuItem>
//                     </Select>
//                   </FormControl>
//                   <Tooltip title={getPatternTooltip(orderingPattern)} arrow>
//                     <HelpOutline fontSize="small" color="action" sx={{ cursor: 'help' }} />
//                   </Tooltip>
//                 </Stack>
//               </Stack>

//               <Typography variant="body2">
//                 <strong>Pattern:</strong> {patternDescription}
//               </Typography>

//               <Typography variant="caption" color="text.secondary">
//                 🎯 Click on a seat in the preview to set Seat #1 position
//               </Typography>
//             </>
//           )}

//           {/* Manual Mode Info */}
//           {orderingMode === 'manual' && (
//             <Typography variant="caption" color="text.secondary">
//               🖱️ Click seats in the order you want them numbered (1, 2, 3, ...)
//             </Typography>
//           )}
//         </Stack>
//       </Paper>

//       {/* Manual Mode Progress */}
//       {orderingMode === 'manual' && (
//         <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0' }}>
//           <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
//             <Stack direction="row" spacing={1} alignItems="center">
//               <Chip
//                 label={`${manualAssignments.size} / ${totalSeats} assigned`}
//                 color={isManualComplete ? 'success' : 'warning'}
//                 size="small"
//               />
//               {isManualComplete && (
//                 <Chip label="Complete!" color="success" size="small" variant="outlined" />
//               )}
//               {!isManualComplete && (
//                 <Typography variant="body2" color="text.secondary">
//                   Click seat to assign #{nextManualNumber}
//                 </Typography>
//               )}
//             </Stack>
//             <Stack direction="row" spacing={1}>
//               <Tooltip title="Undo last assignment">
//                 <span>
//                   <IconButton
//                     size="small"
//                     onClick={handleManualUndo}
//                     disabled={manualHistory.length === 0}
//                   >
//                     <Undo fontSize="small" />
//                   </IconButton>
//                 </span>
//               </Tooltip>
//               <Button
//                 size="small"
//                 startIcon={<Refresh />}
//                 onClick={handleManualReset}
//                 variant="outlined"
//                 disabled={manualAssignments.size === 0}
//               >
//                 Clear All
//               </Button>
//             </Stack>
//           </Stack>
//         </Paper>
//       )}

//       {/* Table Preview */}
//       <ScrollablePreviewContainer maxHeight={maxPreviewHeight} minHeight={280}>
//         <TablePreview
//           type={tableType}
//           roundSeats={roundSeats}
//           rectangleSeats={rectangleSeats}
//           seatOrdering={currentOrdering}
//           seatModes={seatModes}
//           startPosition={startPosition}
//           onSeatClick={handleSeatClick}
//           interactionMode={orderingMode === 'manual' ? 'manual-ordering' : 'ordering'}
//           size={previewSize}
//           showLabels
//           manualAssignments={orderingMode === 'manual' ? manualAssignments : undefined}
//           nextManualNumber={orderingMode === 'manual' ? nextManualNumber : undefined}
//         />
//       </ScrollablePreviewContainer>

//       {/* Sequence Preview */}
//       {orderingMode === 'auto' ? (
//         <PatternPreview seatOrdering={currentOrdering} />
//       ) : (
//         <ManualSequencePreview ordering={currentOrdering} totalSeats={totalSeats} />
//       )}
//     </Stack>
//   );
// }

// ============================================================================
// EXPORTS
// ============================================================================

// export { PatternPreview, ManualSequencePreview };





// components/molecules/SeatOrderingPanel.tsx
// REUSABLE COMPONENT for seat ordering configuration
// Used by: AddTableModal, ModifyTableModal, CreateEditTemplateModal, TemplateCustomizationModal
// Features: Auto mode (pattern-based) and Manual mode (click-to-assign)
// FIXED: Properly initializes from template pattern without triggering false changes

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

  initialDirection?: Direction;
  initialPattern?: OrderingPattern;
  initialStartPosition?: number;
  initialOrdering?: number[];

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

  const isInitialRenderRef = useRef(true);
  const lastResetKeyRef = useRef(resetKey);

  // 🔒 NEW: track last emitted ordering to prevent loops
  const lastEmittedOrderingRef = useRef<number[] | null>(null);

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

  const currentOrdering = useMemo(
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

  useEffect(() => {
    if (resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey;
      isInitialRenderRef.current = true;
      lastEmittedOrderingRef.current = null;

      setDirection(initialDirection);
      setOrderingPattern(initialPattern);
      setStartPosition(initialStartPosition);
      setManualAssignments(new Map());
      setNextManualNumber(1);
      setManualHistory([]);
      setOrderingMode('auto');
    }
  }, [resetKey, initialDirection, initialPattern, initialStartPosition]);

  useEffect(() => {
    if (!initialOrdering || initialOrdering.length !== totalSeats) return;
    if (!isInitialRenderRef.current) return;

    const testAuto = generateOrdering(
      totalSeats,
      initialDirection,
      initialPattern,
      initialStartPosition,
      tableType === 'rectangle' ? rectangleSeats : undefined
    );

    const matches = initialOrdering.every((v, i) => v === testAuto[i]);

    if (!matches) {
      setOrderingMode('manual');
      const map = new Map<number, number>();
      initialOrdering.forEach((seatNum, posIndex) => map.set(posIndex, seatNum));
      setManualAssignments(map);
      setNextManualNumber(totalSeats + 1);
    }
  }, [
    initialOrdering,
    totalSeats,
    initialDirection,
    initialPattern,
    initialStartPosition,
    tableType,
    rectangleSeats,
  ]);

  useEffect(() => {
    if (isInitialRenderRef.current) return;
    if (orderingMode === 'manual') {
      setManualAssignments(new Map());
      setNextManualNumber(1);
      setManualHistory([]);
    }
  }, [totalSeats]);

  useEffect(() => {
    if (startPosition >= totalSeats) setStartPosition(0);
  }, [totalSeats, startPosition]);

  // ✅ FIXED: idempotent parent notification
  useEffect(() => {
    const prev = lastEmittedOrderingRef.current;

    const isSame =
      prev &&
      prev.length === currentOrdering.length &&
      prev.every((v, i) => v === currentOrdering[i]);

    if (isSame) return;

    lastEmittedOrderingRef.current = currentOrdering;
    onOrderingChange(currentOrdering);

    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
    }
  }, [currentOrdering, onOrderingChange]);

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

  const handleResetAll = useCallback(() => {
    setDirection(initialDirection);
    setOrderingPattern(initialPattern);
    setStartPosition(initialStartPosition);
    if (orderingMode === 'manual') handleManualReset();
  }, [orderingMode, handleManualReset, initialDirection, initialPattern, initialStartPosition]);

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
          seatOrdering={currentOrdering}
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
        <PatternPreview seatOrdering={currentOrdering} />
      ) : (
        <ManualSequencePreview ordering={currentOrdering} totalSeats={totalSeats} />
      )}
    </Stack>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PatternPreview, ManualSequencePreview };
