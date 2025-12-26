// // components/molecules/SeatOrderingControls.tsx
// // ENHANCED: Reusable component for configuring seat ordering
// // Now supports both auto-patterns AND manual ordering mode

// 'use client';

// import { useState, useMemo, useCallback, useEffect } from 'react';
// import {
//   Stack,
//   Typography,
//   Paper,
//   ToggleButtonGroup,
//   ToggleButton,
//   Button,
//   FormControl,
//   InputLabel,
//   Select,
//   MenuItem,
//   Tooltip,
//   Box,
//   Collapse,
//   Divider,
//   Chip,
//   Alert,
//   IconButton,
// } from '@mui/material';
// import {
//   Refresh,
//   HelpOutline,
//   TouchApp,
//   AutoMode,
//   Undo,
//   Check,
//   ExpandMore,
//   ExpandLess,
// } from '@mui/icons-material';
// import { Direction, OrderingPattern } from '@/types/Template';
// import { SeatMode } from '@/types/Seat';
// import { useColorScheme } from '@/store/colorModeStore';
// import { ColorScheme } from '@/utils/colorConfig';

// // ============================================================================
// // TYPES
// // ============================================================================

// export type OrderingMode = 'auto' | 'manual';

// export interface SeatOrderingControlsProps {
//   // Ordering configuration
//   direction: Direction;
//   orderingPattern: OrderingPattern;
//   startPosition: number;
//   totalSeats: number;
  
//   // Current ordering (computed or manual)
//   currentOrdering?: number[];
  
//   // Callbacks for auto mode
//   onDirectionChange: (direction: Direction) => void;
//   onPatternChange: (pattern: OrderingPattern) => void;
//   onStartPositionChange?: (position: number) => void;
  
//   // Callback for ordering changes (works for both auto and manual)
//   onOrderingChange?: (ordering: number[]) => void;
  
//   // Manual mode support
//   enableManualMode?: boolean;
//   orderingMode?: OrderingMode;
//   onOrderingModeChange?: (mode: OrderingMode) => void;
  
//   // Reset callback
//   onReset?: () => void;
  
//   // Display options
//   compact?: boolean;
//   showResetButton?: boolean;
//   showHelperText?: boolean;
//   tableType?: 'round' | 'rectangle';
  
//   // For manual mode visual
//   seatModes?: SeatMode[];
//   rectangleSeats?: { top: number; bottom: number; left: number; right: number };
// }

// // ============================================================================
// // HELPER FUNCTIONS
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
//         ? `Alternating: Seat 1 → Evens →→ / Odds ←←`
//         : `Alternating: Seat 1 → Evens ←← / Odds →→`;
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
//       return 'Paired seating: Seat 1 faces Seat 2, Seat 3 faces Seat 4, etc. Great for bilateral discussions where pairs should face each other.';
//     default:
//       return '';
//   }
// }

// // ============================================================================
// // MAIN COMPONENT
// // ============================================================================

// export default function SeatOrderingControls({
//   direction,
//   orderingPattern,
//   startPosition,
//   totalSeats,
//   currentOrdering = [],
//   onDirectionChange,
//   onPatternChange,
//   onStartPositionChange,
//   onOrderingChange,
//   enableManualMode = false,
//   orderingMode = 'auto',
//   onOrderingModeChange,
//   onReset,
//   compact = false,
//   showResetButton = true,
//   showHelperText = true,
//   tableType = 'round',
//   seatModes = [],
//   rectangleSeats,
// }: SeatOrderingControlsProps) {
//   const colorScheme = useColorScheme();
//   const patternDescription = getPatternDescription(orderingPattern, direction, tableType);

//   // Internal state for manual mode
//   const [manualAssignments, setManualAssignments] = useState<Map<number, number>>(new Map());
//   const [nextManualSeatNumber, setNextManualSeatNumber] = useState(1);
//   const [manualHistory, setManualHistory] = useState<Map<number, number>[]>([]);

//   // Is manual ordering complete?
//   const isManualComplete = useMemo(() => {
//     return manualAssignments.size === totalSeats;
//   }, [manualAssignments, totalSeats]);

//   // Initialize manual assignments from current ordering when switching to manual mode
//   useEffect(() => {
//     if (orderingMode === 'manual' && currentOrdering.length === totalSeats) {
//       // Check if current ordering is valid (all positions have numbers)
//       const allAssigned = currentOrdering.every(num => num > 0);
//       if (allAssigned) {
//         const newMap = new Map<number, number>();
//         currentOrdering.forEach((seatNum, posIndex) => {
//           newMap.set(posIndex, seatNum);
//         });
//         setManualAssignments(newMap);
//         setNextManualSeatNumber(totalSeats + 1);
//       } else {
//         // Start fresh for manual mode
//         setManualAssignments(new Map());
//         setNextManualSeatNumber(1);
//       }
//       setManualHistory([]);
//     }
//   }, [orderingMode, totalSeats]);

//   // Reset manual state when total seats changes
//   useEffect(() => {
//     if (orderingMode === 'manual') {
//       setManualAssignments(new Map());
//       setNextManualSeatNumber(1);
//       setManualHistory([]);
//     }
//   }, [totalSeats]);

//   // Handlers for mode switching
//   const handleModeChange = useCallback((mode: OrderingMode) => {
//     if (onOrderingModeChange) {
//       onOrderingModeChange(mode);
//     }
    
//     if (mode === 'manual') {
//       // Clear manual state when entering manual mode
//       setManualAssignments(new Map());
//       setNextManualSeatNumber(1);
//       setManualHistory([]);
//     }
//   }, [onOrderingModeChange]);

//   // Manual ordering handlers
//   const handleManualSeatClick = useCallback((positionIndex: number) => {
//     if (orderingMode !== 'manual') return;
//     if (manualAssignments.has(positionIndex)) return;

//     // Save history
//     setManualHistory(prev => [...prev, new Map(manualAssignments)]);

//     // Assign seat
//     const newMap = new Map(manualAssignments);
//     newMap.set(positionIndex, nextManualSeatNumber);
//     setManualAssignments(newMap);
//     setNextManualSeatNumber(prev => prev + 1);

//     // Update parent
//     if (onOrderingChange) {
//       const newOrdering = new Array(totalSeats).fill(0);
//       newMap.forEach((seatNum, posIndex) => {
//         newOrdering[posIndex] = seatNum;
//       });
//       onOrderingChange(newOrdering);
//     }
//   }, [orderingMode, manualAssignments, nextManualSeatNumber, totalSeats, onOrderingChange]);

//   const handleManualUndo = useCallback(() => {
//     if (manualHistory.length === 0) return;

//     const prevState = manualHistory[manualHistory.length - 1];
//     setManualHistory(prev => prev.slice(0, -1));
//     setManualAssignments(prevState);
//     setNextManualSeatNumber(prev => Math.max(1, prev - 1));

//     if (onOrderingChange) {
//       const newOrdering = new Array(totalSeats).fill(0);
//       prevState.forEach((seatNum, posIndex) => {
//         newOrdering[posIndex] = seatNum;
//       });
//       onOrderingChange(newOrdering);
//     }
//   }, [manualHistory, totalSeats, onOrderingChange]);

//   const handleManualReset = useCallback(() => {
//     setManualHistory([]);
//     setManualAssignments(new Map());
//     setNextManualSeatNumber(1);
    
//     if (onOrderingChange) {
//       onOrderingChange(new Array(totalSeats).fill(0));
//     }
//   }, [totalSeats, onOrderingChange]);

//   const handleFullReset = useCallback(() => {
//     if (orderingMode === 'manual') {
//       handleManualReset();
//     }
//     if (onReset) {
//       onReset();
//     }
//   }, [orderingMode, handleManualReset, onReset]);

//   // Get manual ordering array
//   const getManualOrdering = useCallback((): number[] => {
//     const ordering = new Array(totalSeats).fill(0);
//     manualAssignments.forEach((seatNum, posIndex) => {
//       ordering[posIndex] = seatNum;
//     });
//     return ordering;
//   }, [manualAssignments, totalSeats]);

//   return (
//     <Paper elevation={0} sx={{ p: compact ? 1.5 : 2, bgcolor: '#e3f2fd' }}>
//       <Stack spacing={compact ? 1.5 : 2}>
//         {/* Mode Toggle (if manual mode enabled) */}
//         {enableManualMode && (
//           <>
//             <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
//               <Typography variant={compact ? 'body2' : 'subtitle2'} fontWeight="bold">
//                 Ordering Mode:
//               </Typography>
//               <ToggleButtonGroup
//                 value={orderingMode}
//                 exclusive
//                 onChange={(_, val) => val && handleModeChange(val)}
//                 size="small"
//               >
//                 <ToggleButton value="auto">
//                   <Tooltip title="Use pattern-based auto ordering">
//                     <Stack direction="row" spacing={0.5} alignItems="center">
//                       <AutoMode fontSize="small" />
//                       {!compact && <span>Auto Pattern</span>}
//                     </Stack>
//                   </Tooltip>
//                 </ToggleButton>
//                 <ToggleButton value="manual">
//                   <Tooltip title="Manually click seats to assign numbers">
//                     <Stack direction="row" spacing={0.5} alignItems="center">
//                       <TouchApp fontSize="small" />
//                       {!compact && <span>Manual</span>}
//                     </Stack>
//                   </Tooltip>
//                 </ToggleButton>
//               </ToggleButtonGroup>
//             </Stack>
//             <Divider />
//           </>
//         )}

//         {/* AUTO MODE CONTROLS */}
//         {orderingMode === 'auto' && (
//           <>
//             <Stack 
//               direction={compact ? 'column' : 'row'} 
//               spacing={2} 
//               alignItems={compact ? 'flex-start' : 'center'}
//               justifyContent="space-between"
//               flexWrap="wrap"
//             >
//               {/* Direction */}
//               <Stack direction="row" spacing={2} alignItems="center">
//                 <Typography variant={compact ? 'body2' : 'subtitle2'}>Direction:</Typography>
//                 <ToggleButtonGroup
//                   value={direction}
//                   exclusive
//                   onChange={(_, val) => val && onDirectionChange(val)}
//                   size="small"
//                 >
//                   <ToggleButton value="clockwise">
//                     {compact ? '↻' : 'Clockwise ↻'}
//                   </ToggleButton>
//                   <ToggleButton value="counter-clockwise">
//                     {compact ? '↺' : 'Counter ↺'}
//                   </ToggleButton>
//                 </ToggleButtonGroup>
//               </Stack>

//               {/* Pattern Selection */}
//               <Stack direction="row" spacing={1} alignItems="center">
//                 <FormControl size="small" sx={{ minWidth: compact ? 120 : 150 }}>
//                   <InputLabel>Pattern</InputLabel>
//                   <Select
//                     value={orderingPattern}
//                     label="Pattern"
//                     onChange={(e) => onPatternChange(e.target.value as OrderingPattern)}
//                   >
//                     <MenuItem value="sequential">Sequential</MenuItem>
//                     <MenuItem value="alternating">Alternating</MenuItem>
//                     <MenuItem value="opposite">Opposite</MenuItem>
//                   </Select>
//                 </FormControl>
//                 <Tooltip title={getPatternTooltip(orderingPattern)} arrow>
//                   <HelpOutline fontSize="small" color="action" sx={{ cursor: 'help' }} />
//                 </Tooltip>
//               </Stack>

//               {showResetButton && onReset && (
//                 <Button
//                   size="small"
//                   startIcon={<Refresh />}
//                   onClick={handleFullReset}
//                   variant="outlined"
//                 >
//                   Reset
//                 </Button>
//               )}
//             </Stack>

//             {/* Helper Text for Auto Mode */}
//             {showHelperText && (
//               <>
//                 <Typography variant="caption" color="text.secondary">
//                   📌 Click on a seat in the preview to set Seat #1 position
//                 </Typography>

//                 <Typography variant="body2">
//                   <strong>Pattern: </strong>
//                   {patternDescription}
//                 </Typography>

//                 {orderingPattern === 'opposite' && (
//                   <Box 
//                     sx={{ 
//                       bgcolor: '#fff3e0', 
//                       p: 1, 
//                       borderRadius: 1,
//                       border: '1px solid #ffb74d',
//                     }}
//                   >
//                     <Typography variant="caption" color="warning.dark">
//                       💡 <strong>Opposite Pattern:</strong> Seat #1 will face Seat #2 across the table. 
//                       Seat #3 is next to #1 (in direction), and faces #4, and so on.
//                       {tableType === 'rectangle' && ' For rectangles, top↔bottom and left↔right are paired.'}
//                     </Typography>
//                   </Box>
//                 )}
//               </>
//             )}
//           </>
//         )}

//         {/* MANUAL MODE CONTROLS */}
//         {orderingMode === 'manual' && (
//           <>
//             <Alert severity="info" icon={<TouchApp />} sx={{ py: 0.5 }}>
//               <Typography variant="body2">
//                 <strong>Manual Mode:</strong> Click seats in the order you want them numbered.
//                 {nextManualSeatNumber <= totalSeats && (
//                   <> Seat <strong>#{nextManualSeatNumber}</strong> is next.</>
//                 )}
//               </Typography>
//             </Alert>

//             {/* Progress and Controls */}
//             <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
//               <Stack direction="row" spacing={1} alignItems="center">
//                 <Chip
//                   label={`${manualAssignments.size} / ${totalSeats}`}
//                   color={isManualComplete ? 'success' : 'default'}
//                   size="small"
//                 />
//                 {isManualComplete && (
//                   <Chip
//                     icon={<Check />}
//                     label="Complete!"
//                     color="success"
//                     size="small"
//                   />
//                 )}
//               </Stack>

//               <Stack direction="row" spacing={1}>
//                 <Tooltip title="Undo last assignment">
//                   <span>
//                     <IconButton
//                       size="small"
//                       onClick={handleManualUndo}
//                       disabled={manualHistory.length === 0}
//                     >
//                       <Undo fontSize="small" />
//                     </IconButton>
//                   </span>
//                 </Tooltip>
//                 <Button
//                   size="small"
//                   startIcon={<Refresh />}
//                   onClick={handleManualReset}
//                   variant="outlined"
//                 >
//                   Clear
//                 </Button>
//               </Stack>
//             </Stack>

//             {/* Manual sequence preview */}
//             {manualAssignments.size > 0 && (
//               <Box sx={{ p: 1, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
//                 <Typography variant="caption" color="text.secondary">
//                   <strong>Sequence:</strong>{' '}
//                   {getManualOrdering()
//                     .map((num, idx) => (num > 0 ? `${num}` : '?'))
//                     .join(' → ')}
//                 </Typography>
//               </Box>
//             )}
//           </>
//         )}
//       </Stack>
//     </Paper>
//   );
// }

// // ============================================================================
// // EXPORTED HELPERS
// // ============================================================================

// /**
//  * Export manual mode state interface for parent components
//  */
// export interface ManualOrderingState {
//   assignments: Map<number, number>;
//   nextSeatNumber: number;
//   isComplete: boolean;
// }

// /**
//  * Get a seat click handler that works for both auto and manual modes
//  */
// export function createSeatClickHandler(
//   orderingMode: OrderingMode,
//   onAutoClick: (positionIndex: number) => void,
//   onManualClick: (positionIndex: number) => void
// ): (positionIndex: number) => void {
//   return (positionIndex: number) => {
//     if (orderingMode === 'auto') {
//       onAutoClick(positionIndex);
//     } else {
//       onManualClick(positionIndex);
//     }
//   };
// }

// // ============================================================================
// // PATTERN PREVIEW (unchanged from original)
// // ============================================================================

// interface PatternPreviewProps {
//   seatOrdering: number[];
//   maxShow?: number;
// }

// export function PatternPreview({ seatOrdering, maxShow = 12 }: PatternPreviewProps) {
//   const count = seatOrdering.length;
//   const preview = seatOrdering.slice(0, maxShow).join(' → ');
//   const fullPreview = count > maxShow ? `${preview} ...` : preview;

//   return (
//     <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
//       <Typography variant="caption" color="text.secondary">
//         💡 <strong>Full Sequence:</strong> {seatOrdering.join(', ')}
//       </Typography>
//     </Paper>
//   );
// }