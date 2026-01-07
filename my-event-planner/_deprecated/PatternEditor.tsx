// // components/molecules/PatternEditor.tsx
// // Interactive pattern editor with intelligent scaling preview
// // Allows users to configure seat modes and see how patterns scale
// // UPDATED: Scrollable preview areas for large tables

// 'use client';

// import { useState, useMemo, useEffect } from 'react';
// import {
//   Box,
//   Paper,
//   Typography,
//   Stack,
//   Chip,
//   Button,
//   Slider,
//   ToggleButtonGroup,
//   ToggleButton,
//   Alert,
//   Divider,
//   Menu,
//   MenuItem,
//   ListItemIcon,
//   ListItemText,
//   Tooltip,
//   IconButton,
// } from '@mui/material';
// import {
//   Person,
//   Public,
//   RadioButtonUnchecked,
//   Refresh,
//   Info,
//   ContentCopy,
//   AutoFixHigh,
// } from '@mui/icons-material';
// import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';
// import { useColorScheme } from '@/store/colorModeStore';
// import { 
//   detectPattern, 
//   DetectedPattern, 
//   PatternStrategy,
//   getPatternSummary 
// } from '@/utils/patternDetector';
// import { 
//   scalePattern, 
//   generatePatternPreview,
//   modesToString,
// } from '@/utils/patternScaler';
// import TablePreview from '../atoms/TablePreview';

// // ============================================================================
// // TYPES
// // ============================================================================

// interface PatternEditorProps {
//   // Current seat modes
//   seatModes: SeatMode[];
  
//   // Table configuration
//   tableType: 'round' | 'rectangle';
//   baseSeatCount: number;
//   rectangleSeats?: { top: number; bottom: number; left: number; right: number };
//   seatOrdering: number[];
  
//   // Callbacks
//   onModesChange: (modes: SeatMode[]) => void;
  
//   // Optional: min/max for preview
//   minSeats?: number;
//   maxSeats?: number;
// }

// // ============================================================================
// // SCROLLABLE PREVIEW CONTAINER - Key component for large tables
// // ============================================================================

// interface ScrollablePreviewContainerProps {
//   children: React.ReactNode;
//   maxHeight?: number;
// }

// function ScrollablePreviewContainer({ 
//   children, 
//   maxHeight = 400,
// }: ScrollablePreviewContainerProps) {
//   return (
//     <Box
//       sx={{
//         bgcolor: 'white',
//         borderRadius: 1,
//         border: '1px solid',
//         borderColor: 'divider',
//         maxHeight,
//         overflow: 'auto',
//         my: 2,
//       }}
//     >
//       <Box
//         sx={{
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'center',
//           p: 2,
//           minWidth: 'max-content',
//           minHeight: 'max-content',
//         }}
//       >
//         {children}
//       </Box>
//     </Box>
//   );
// }

// // ============================================================================
// // PATTERN STRATEGY LABELS
// // ============================================================================

// const STRATEGY_LABELS: Record<PatternStrategy, { label: string; description: string; icon: string }> = {
//   'repeating-sequence': {
//     label: 'Repeating Pattern',
//     description: 'A fixed sequence that repeats around the table',
//     icon: '🔄',
//   },
//   'ratio-interleaved': {
//     label: 'Distributed Ratio',
//     description: 'Modes distributed evenly while maintaining proportions',
//     icon: '⚖️',
//   },
//   'ratio-contiguous': {
//     label: 'Block Ratio',
//     description: 'Modes grouped in contiguous blocks (e.g., first half H, second half E)',
//     icon: '📊',
//   },
//   'uniform': {
//     label: 'Uniform',
//     description: 'All seats have the same mode',
//     icon: '▫️',
//   },
//   'custom': {
//     label: 'Custom',
//     description: 'Irregular pattern (scaled proportionally)',
//     icon: '✏️',
//   },
// };

// // ============================================================================
// // QUICK PATTERN PRESETS
// // ============================================================================

// interface PatternPreset {
//   name: string;
//   description: string;
//   generateModes: (count: number) => SeatMode[];
// }

// const PATTERN_PRESETS: PatternPreset[] = [
//   {
//     name: 'All Default',
//     description: 'No restrictions',
//     generateModes: (count) => Array(count).fill('default'),
//   },
//   {
//     name: 'Alternating H/E',
//     description: 'Host, External, Host, External...',
//     generateModes: (count) => {
//       const modes: SeatMode[] = [];
//       for (let i = 0; i < count; i++) {
//         modes.push(i % 2 === 0 ? 'host-only' : 'external-only');
//       }
//       return modes;
//     },
//   },
//   {
//     name: 'Pairs H/E',
//     description: 'HH, EE, HH, EE...',
//     generateModes: (count) => {
//       const modes: SeatMode[] = [];
//       for (let i = 0; i < count; i++) {
//         modes.push(Math.floor(i / 2) % 2 === 0 ? 'host-only' : 'external-only');
//       }
//       return modes;
//     },
//   },
//   {
//     name: 'Groups of 3',
//     description: 'HHH, EEE, HHH, EEE...',
//     generateModes: (count) => {
//       const modes: SeatMode[] = [];
//       for (let i = 0; i < count; i++) {
//         modes.push(Math.floor(i / 3) % 2 === 0 ? 'host-only' : 'external-only');
//       }
//       return modes;
//     },
//   },
//   {
//     name: '50/50 Split',
//     description: 'First half Host, second half External',
//     generateModes: (count) => {
//       const half = Math.ceil(count / 2);
//       const modes: SeatMode[] = [];
//       for (let i = 0; i < count; i++) {
//         modes.push(i < half ? 'host-only' : 'external-only');
//       }
//       return modes;
//     },
//   },
//   {
//     name: 'VIP First Two',
//     description: 'Host seats 1-2, rest default',
//     generateModes: (count) => {
//       const modes: SeatMode[] = Array(count).fill('default');
//       if (count >= 1) modes[0] = 'host-only';
//       if (count >= 2) modes[1] = 'host-only';
//       return modes;
//     },
//   },
//   {
//     name: 'Mixed Ratio',
//     description: 'H, H, E, E, D, D repeating',
//     generateModes: (count) => {
//       const pattern: SeatMode[] = ['host-only', 'host-only', 'external-only', 'external-only', 'default', 'default'];
//       const modes: SeatMode[] = [];
//       for (let i = 0; i < count; i++) {
//         modes.push(pattern[i % pattern.length]);
//       }
//       return modes;
//     },
//   },
// ];

// // ============================================================================
// // SCALING PREVIEW COMPONENT
// // ============================================================================

// interface ScalingPreviewProps {
//   detectedPattern: DetectedPattern;
//   currentCount: number;
//   minSeats: number;
//   maxSeats: number;
// }

// function ScalingPreview({ detectedPattern, currentCount, minSeats, maxSeats }: ScalingPreviewProps) {
//   // Generate previews at different sizes
//   const previewSizes = useMemo(() => {
//     const sizes: number[] = [];
    
//     // Include min, current, and max
//     sizes.push(minSeats);
    
//     // Add some intermediate sizes
//     const step = Math.max(2, Math.floor((maxSeats - minSeats) / 4));
//     for (let s = minSeats + step; s < maxSeats; s += step) {
//       if (s !== currentCount) sizes.push(s);
//     }
    
//     if (currentCount !== minSeats && currentCount !== maxSeats) {
//       sizes.push(currentCount);
//     }
    
//     sizes.push(maxSeats);
    
//     return [...new Set(sizes)].sort((a, b) => a - b);
//   }, [minSeats, maxSeats, currentCount]);

//   const previews = useMemo(() => {
//     return previewSizes.map(size => ({
//       size,
//       modes: scalePattern(detectedPattern, size),
//       isCurrent: size === currentCount,
//     }));
//   }, [previewSizes, detectedPattern, currentCount]);

//   return (
//     <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
//       <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//         <Info fontSize="small" />
//         Scaling Preview
//       </Typography>
//       <Typography variant="caption" color="text.secondary" paragraph>
//         How this pattern scales at different seat counts:
//       </Typography>
      
//       <Stack spacing={1}>
//         {previews.map(({ size, modes, isCurrent }) => (
//           <Box
//             key={size}
//             sx={{
//               display: 'flex',
//               alignItems: 'center',
//               gap: 2,
//               p: 1,
//               borderRadius: 1,
//               bgcolor: isCurrent ? 'primary.50' : 'white',
//               border: '1px solid',
//               borderColor: isCurrent ? 'primary.main' : 'divider',
//             }}
//           >
//             <Chip
//               label={`${size} seats`}
//               size="small"
//               color={isCurrent ? 'primary' : 'default'}
//               sx={{ minWidth: 80 }}
//             />
//             <Typography
//               variant="body2"
//               fontFamily="monospace"
//               sx={{
//                 letterSpacing: 1,
//                 flex: 1,
//                 overflow: 'hidden',
//                 textOverflow: 'ellipsis',
//                 whiteSpace: 'nowrap',
//               }}
//             >
//               {modesToString(modes)}
//             </Typography>
//           </Box>
//         ))}
//       </Stack>
//     </Paper>
//   );
// }

// // ============================================================================
// // MODE STATISTICS
// // ============================================================================

// interface ModeStatsProps {
//   modes: SeatMode[];
// }

// function ModeStats({ modes }: ModeStatsProps) {
//   const stats = useMemo(() => {
//     const counts = {
//       'host-only': modes.filter(m => m === 'host-only').length,
//       'external-only': modes.filter(m => m === 'external-only').length,
//       'default': modes.filter(m => m === 'default').length,
//     };
    
//     const total = modes.length || 1;
    
//     return {
//       counts,
//       percentages: {
//         'host-only': Math.round((counts['host-only'] / total) * 100),
//         'external-only': Math.round((counts['external-only'] / total) * 100),
//         'default': Math.round((counts['default'] / total) * 100),
//       },
//     };
//   }, [modes]);

//   return (
//     <Stack direction="row" spacing={2} flexWrap="wrap">
//       <Chip
//         icon={<Person fontSize="small" />}
//         label={`Host: ${stats.counts['host-only']} (${stats.percentages['host-only']}%)`}
//         size="small"
//         sx={{ bgcolor: '#bbdefb' }}
//       />
//       <Chip
//         icon={<Public fontSize="small" />}
//         label={`External: ${stats.counts['external-only']} (${stats.percentages['external-only']}%)`}
//         size="small"
//         sx={{ bgcolor: '#ffcdd2' }}
//       />
//       <Chip
//         icon={<RadioButtonUnchecked fontSize="small" />}
//         label={`Default: ${stats.counts['default']} (${stats.percentages['default']}%)`}
//         size="small"
//         sx={{ bgcolor: '#e8f5e9' }}
//       />
//     </Stack>
//   );
// }

// // ============================================================================
// // MAIN PATTERN EDITOR COMPONENT
// // ============================================================================

// export default function PatternEditor({
//   seatModes,
//   tableType,
//   baseSeatCount,
//   rectangleSeats,
//   seatOrdering,
//   onModesChange,
//   minSeats = 4,
//   maxSeats = 20,
// }: PatternEditorProps) {
//   const colorScheme = useColorScheme();
  
//   // Menu state for seat click
//   const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
//   const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  
//   // Preset menu
//   const [presetAnchor, setPresetAnchor] = useState<null | HTMLElement>(null);
  
//   // Detected pattern
//   const detectedPattern = useMemo(() => detectPattern(seatModes), [seatModes]);
  
//   // Pattern string for display
//   const patternString = useMemo(() => modesToString(seatModes), [seatModes]);
  
//   // Strategy info
//   const strategyInfo = STRATEGY_LABELS[detectedPattern.strategy];

//   // ========== HANDLERS ==========
  
//   const handleSeatClick = (event: React.MouseEvent, index: number) => {
//     setMenuAnchor(event.currentTarget as HTMLElement);
//     setSelectedSeatIndex(index);
//   };

//   const handleMenuClose = () => {
//     setMenuAnchor(null);
//     setSelectedSeatIndex(null);
//   };

//   const handleModeSelect = (mode: SeatMode) => {
//     if (selectedSeatIndex !== null) {
//       const newModes = [...seatModes];
//       newModes[selectedSeatIndex] = mode;
//       onModesChange(newModes);
//     }
//     handleMenuClose();
//   };

//   const handlePresetSelect = (preset: PatternPreset) => {
//     const newModes = preset.generateModes(baseSeatCount);
//     onModesChange(newModes);
//     setPresetAnchor(null);
//   };

//   const handleReset = () => {
//     onModesChange(Array(baseSeatCount).fill('default'));
//   };

//   const handleSetAll = (mode: SeatMode) => {
//     onModesChange(Array(baseSeatCount).fill(mode));
//   };

//   return (
//     <Stack spacing={3}>
//       {/* Pattern Detection Info */}
//       <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
//         <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
//           <Typography variant="h6" sx={{ fontSize: 24 }}>
//             {strategyInfo.icon}
//           </Typography>
//           <Box sx={{ flex: 1, minWidth: 200 }}>
//             <Typography variant="subtitle2" fontWeight="bold">
//               Detected: {strategyInfo.label}
//             </Typography>
//             <Typography variant="caption" color="text.secondary">
//               {detectedPattern.description}
//             </Typography>
//           </Box>
//           <Chip
//             label={`Confidence: ${Math.round(detectedPattern.confidence * 100)}%`}
//             size="small"
//             color={detectedPattern.confidence > 0.9 ? 'success' : 'warning'}
//           />
//         </Stack>
//       </Paper>

//       {/* Quick Actions */}
//       <Stack direction="row" spacing={2} flexWrap="wrap">
//         <Button
//           variant="outlined"
//           size="small"
//           startIcon={<AutoFixHigh />}
//           onClick={(e) => setPresetAnchor(e.currentTarget)}
//         >
//           Quick Patterns
//         </Button>
//         <Button
//           variant="outlined"
//           size="small"
//           startIcon={<Refresh />}
//           onClick={handleReset}
//         >
//           Reset All
//         </Button>
//         <ToggleButtonGroup size="small">
//           <ToggleButton value="host" onClick={() => handleSetAll('host-only')}>
//             <Tooltip title="Set all to Host-only">
//               <Person fontSize="small" />
//             </Tooltip>
//           </ToggleButton>
//           <ToggleButton value="external" onClick={() => handleSetAll('external-only')}>
//             <Tooltip title="Set all to External-only">
//               <Public fontSize="small" />
//             </Tooltip>
//           </ToggleButton>
//           <ToggleButton value="default" onClick={() => handleSetAll('default')}>
//             <Tooltip title="Set all to Default">
//               <RadioButtonUnchecked fontSize="small" />
//             </Tooltip>
//           </ToggleButton>
//         </ToggleButtonGroup>
//       </Stack>

//       {/* Preset Menu */}
//       <Menu
//         anchorEl={presetAnchor}
//         open={Boolean(presetAnchor)}
//         onClose={() => setPresetAnchor(null)}
//       >
//         {PATTERN_PRESETS.map((preset) => (
//           <MenuItem key={preset.name} onClick={() => handlePresetSelect(preset)}>
//             <ListItemText 
//               primary={preset.name} 
//               secondary={preset.description}
//             />
//           </MenuItem>
//         ))}
//       </Menu>

//       {/* Interactive Table Preview - UPDATED: Scrollable container */}
//       <Paper elevation={0} sx={{ p: 3, bgcolor: '#fafafa', borderRadius: 2 }}>
//         <Typography variant="subtitle2" gutterBottom>
//           Click seats to change their mode:
//         </Typography>
        
//         {/* Scrollable preview container */}
//         <ScrollablePreviewContainer maxHeight={400}>
//           <TablePreview
//             type={tableType}
//             roundSeats={tableType === 'round' ? baseSeatCount : undefined}
//             rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
//             seatOrdering={seatOrdering}
//             seatModes={seatModes}
//             onSeatClick={handleSeatClick}
//             interactionMode="modes"
//             size="large"
//             showLabels={true}
//             colorScheme={colorScheme}
//           />
//         </ScrollablePreviewContainer>
        
//         {/* Mode Statistics */}
//         <ModeStats modes={seatModes} />
        
//         {/* Pattern String */}
//         <Box sx={{ mt: 2, p: 1.5, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
//           <Typography variant="caption" color="text.secondary">
//             Pattern:
//           </Typography>
//           <Typography variant="body2" fontFamily="monospace" sx={{ letterSpacing: 2 }}>
//             {patternString}
//           </Typography>
//         </Box>
//       </Paper>

//       {/* Seat Mode Selection Menu */}
//       <Menu
//         anchorEl={menuAnchor}
//         open={Boolean(menuAnchor)}
//         onClose={handleMenuClose}
//       >
//         <MenuItem onClick={() => handleModeSelect('host-only')}>
//           <ListItemIcon>
//             <Person fontSize="small" sx={{ color: '#1976d2' }} />
//           </ListItemIcon>
//           <ListItemText 
//             primary="Host Only"
//             secondary="Only host guests can sit here"
//           />
//         </MenuItem>
//         <MenuItem onClick={() => handleModeSelect('external-only')}>
//           <ListItemIcon>
//             <Public fontSize="small" sx={{ color: '#d32f2f' }} />
//           </ListItemIcon>
//           <ListItemText 
//             primary="External Only"
//             secondary="Only external guests can sit here"
//           />
//         </MenuItem>
//         <MenuItem onClick={() => handleModeSelect('default')}>
//           <ListItemIcon>
//             <RadioButtonUnchecked fontSize="small" sx={{ color: '#4caf50' }} />
//           </ListItemIcon>
//           <ListItemText 
//             primary="Default"
//             secondary="Any guest can sit here"
//           />
//         </MenuItem>
//       </Menu>

//       {/* Scaling Preview */}
//       <ScalingPreview
//         detectedPattern={detectedPattern}
//         currentCount={baseSeatCount}
//         minSeats={minSeats}
//         maxSeats={maxSeats}
//       />

//       {/* Legend */}
//       <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff8e1', borderRadius: 2 }}>
//         <Typography variant="subtitle2" gutterBottom>
//           💡 How Pattern Scaling Works
//         </Typography>
//         <Typography variant="body2" color="text.secondary">
//           {detectedPattern.strategy === 'repeating-sequence' && (
//             <>
//               Your pattern repeats in a sequence. When seats are added, the sequence continues.
//               When seats are removed, the sequence is truncated from the end.
//             </>
//           )}
//           {detectedPattern.strategy === 'ratio-interleaved' && (
//             <>
//               Your pattern maintains a ratio between modes, distributed evenly around the table.
//               The ratio will be preserved as seats are added or removed.
//             </>
//           )}
//           {detectedPattern.strategy === 'ratio-contiguous' && (
//             <>
//               Your pattern has contiguous blocks of each mode type.
//               The proportions will be maintained as the table size changes.
//             </>
//           )}
//           {detectedPattern.strategy === 'uniform' && (
//             <>
//               All seats have the same mode. New seats will also have this mode.
//             </>
//           )}
//           {detectedPattern.strategy === 'custom' && (
//             <>
//               Your pattern is irregular. It will be scaled proportionally - 
//               positions will be mapped to the closest equivalent position at the new size.
//             </>
//           )}
//         </Typography>
//       </Paper>
//     </Stack>
//   );
// }

// // ============================================================================
// // EXPORTS
// // ============================================================================

// export { ModeStats, ScalingPreview, PATTERN_PRESETS };