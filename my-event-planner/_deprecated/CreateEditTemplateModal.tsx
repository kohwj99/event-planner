// // components/molecules/CreateEditTemplateModal.tsx
// // Modal for creating/editing table templates
// // REFACTORED: Uses SeatOrderingPanel and SeatModePanel reusable components
// // Features: Template creation with pattern detection, scaling preview

// 'use client';

// import { useState, useMemo, useEffect, useCallback } from 'react';
// import {
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
//   Button,
//   TextField,
//   Stack,
//   Typography,
//   Box,
//   Paper,
//   Chip,
//   Divider,
//   Tabs,
//   Tab,
//   ToggleButtonGroup,
//   ToggleButton,
//   FormControlLabel,
//   Slider,
//   Alert,
//   FormGroup,
//   Checkbox,
// } from '@mui/material';
// import {
//   Circle,
//   Rectangle,
//   Check,
// } from '@mui/icons-material';
// import { SeatMode } from '@/types/Seat';
// import { EventType } from '@/types/Event';
// import {
//   TableTemplate,
//   Direction,
//   OrderingPattern,
//   CreateTemplateInput,
//   isEnhancedPattern,
//   SESSION_TYPE_COLORS,
// } from '@/types/Template';
// import {
//   generateOrdering,
//   validateTemplate,
//   getTemplateBaseSeatCount,
//   createPatternFromModes,
// } from '@/utils/templateScaler';
// import { detectPattern } from '@/utils/patternDetector';
// import { scalePattern, modesToString } from '@/utils/patternScaler';

// // Reusable components
// import TablePreview from '../atoms/TablePreview';
// import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';
// import SeatOrderingPanel, { OrderingMode } from './SeatOrderingPanel';
// import SeatModePanel from './SeatModePanel';

// // ============================================================================
// // TYPES
// // ============================================================================

// interface CreateEditTemplateModalProps {
//   open: boolean;
//   onClose: () => void;
//   onSave: (template: CreateTemplateInput) => void;
//   editTemplate?: TableTemplate | null;
//   initialSessionType?: EventType | null;
// }

// type TabValue = 'basic' | 'ordering' | 'modes' | 'preview';

// // ============================================================================
// // MAIN COMPONENT
// // ============================================================================

// export default function CreateEditTemplateModal({
//   open,
//   onClose,
//   onSave,
//   editTemplate = null,
//   initialSessionType = null,
// }: CreateEditTemplateModalProps) {
//   const isEditing = !!editTemplate;

//   // Current tab
//   const [currentTab, setCurrentTab] = useState<TabValue>('basic');
  
//   // Reset key for child components
//   const [resetKey, setResetKey] = useState(0);

//   // ============================================================================
//   // BASIC INFO STATE
//   // ============================================================================

//   const [name, setName] = useState('');
//   const [description, setDescription] = useState('');
//   const [selectedSessionTypes, setSelectedSessionTypes] = useState<EventType[]>([]);
//   const [tableType, setTableType] = useState<'round' | 'rectangle'>('round');

//   // ============================================================================
//   // SEAT COUNT STATE
//   // ============================================================================

//   const [roundSeatCount, setRoundSeatCount] = useState(8);
//   const [rectangleSeats, setRectangleSeats] = useState({ top: 3, bottom: 3, left: 1, right: 1 });
//   const [growthSides, setGrowthSides] = useState({ top: true, bottom: true, left: false, right: false });
//   const [minSeats, setMinSeats] = useState(4);
//   const [maxSeats, setMaxSeats] = useState(16);

//   // ============================================================================
//   // ORDERING STATE (managed by panel, stored for save)
//   // ============================================================================

//   const [seatOrdering, setSeatOrdering] = useState<number[]>([]);
//   const [orderingConfig, setOrderingConfig] = useState({
//     direction: 'counter-clockwise' as Direction,
//     pattern: 'sequential' as OrderingPattern,
//     startPosition: 0,
//     mode: 'auto' as OrderingMode,
//   });

//   // ============================================================================
//   // SEAT MODES STATE
//   // ============================================================================

//   const [seatModes, setSeatModes] = useState<SeatMode[]>([]);

//   // ============================================================================
//   // COMPUTED VALUES
//   // ============================================================================

//   const baseSeatCount = useMemo(() => {
//     if (tableType === 'round') return roundSeatCount;
//     return rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
//   }, [tableType, roundSeatCount, rectangleSeats]);

//   const detectedPattern = useMemo(() => {
//     return detectPattern(seatModes);
//   }, [seatModes]);

//   const validationErrors = useMemo(() => {
//     const template: Partial<TableTemplate> = {
//       name,
//       sessionTypes: selectedSessionTypes,
//       baseConfig: {
//         type: tableType,
//         baseSeatCount: tableType === 'round' ? roundSeatCount : undefined,
//         baseSeats: tableType === 'rectangle' ? rectangleSeats : undefined,
//         growthSides: tableType === 'rectangle' ? growthSides : undefined,
//       },
//       minSeats,
//       maxSeats,
//     };
//     return validateTemplate(template);
//   }, [name, selectedSessionTypes, tableType, roundSeatCount, rectangleSeats, growthSides, minSeats, maxSeats]);

//   const isValid = validationErrors.length === 0;

//   // ============================================================================
//   // EFFECTS
//   // ============================================================================

//   // Initialize seat modes when seat count changes
//   useEffect(() => {
//     setSeatModes((prev) => {
//       if (prev.length === baseSeatCount) return prev;

//       // Scale existing modes using pattern detection
//       if (prev.length > 0) {
//         const pattern = detectPattern(prev);
//         return scalePattern(pattern, baseSeatCount);
//       }

//       // Initialize with all default
//       return Array(baseSeatCount).fill('default' as SeatMode);
//     });
//   }, [baseSeatCount]);

//   // Load existing template data when editing
//   useEffect(() => {
//     if (editTemplate) {
//       setName(editTemplate.name);
//       setDescription(editTemplate.description);
//       setSelectedSessionTypes([...editTemplate.sessionTypes]);
//       setTableType(editTemplate.baseConfig.type);
//       setMinSeats(editTemplate.minSeats);
//       setMaxSeats(editTemplate.maxSeats);

//       if (editTemplate.baseConfig.type === 'round') {
//         setRoundSeatCount(editTemplate.baseConfig.baseSeatCount || 8);
//       } else {
//         setRectangleSeats(editTemplate.baseConfig.baseSeats || { top: 3, bottom: 3, left: 1, right: 1 });
//         setGrowthSides(editTemplate.baseConfig.growthSides || { top: true, bottom: true, left: false, right: false });
//       }

//       // Set ordering config
//       setOrderingConfig({
//         direction: editTemplate.orderingDirection,
//         pattern: editTemplate.orderingPattern,
//         startPosition: editTemplate.startPosition,
//         mode: 'auto',
//       });

//       // Load pattern
//       if (isEnhancedPattern(editTemplate.seatModePattern)) {
//         setSeatModes([...editTemplate.seatModePattern.baseModes]);
//       } else {
//         // Convert legacy pattern to modes
//         const baseCount = getTemplateBaseSeatCount(editTemplate);
//         const modes: SeatMode[] = [];
//         const pattern = editTemplate.seatModePattern;

//         if (pattern.type === 'repeating' && pattern.pattern) {
//           for (let i = 0; i < baseCount; i++) {
//             modes.push(pattern.pattern[i % pattern.pattern.length]);
//           }
//         } else if (pattern.type === 'alternating' && pattern.alternatingModes) {
//           for (let i = 0; i < baseCount; i++) {
//             modes.push(pattern.alternatingModes[i % 2]);
//           }
//         } else if (pattern.type === 'specific') {
//           for (let i = 0; i < baseCount; i++) {
//             modes.push(pattern.specificModes?.[i] || pattern.defaultMode);
//           }
//         } else {
//           for (let i = 0; i < baseCount; i++) {
//             modes.push(pattern.defaultMode);
//           }
//         }

//         setSeatModes(modes);
//       }

//       setResetKey((prev) => prev + 1);
//     }
//   }, [editTemplate]);

//   // Reset form when modal opens for new template
//   useEffect(() => {
//     if (open && !editTemplate) {
//       setName('');
//       setDescription('');
//       setSelectedSessionTypes(initialSessionType ? [initialSessionType] : []);
//       setTableType('round');
//       setRoundSeatCount(8);
//       setRectangleSeats({ top: 3, bottom: 3, left: 1, right: 1 });
//       setGrowthSides({ top: true, bottom: true, left: false, right: false });
//       setMinSeats(4);
//       setMaxSeats(16);
//       setSeatModes(Array(8).fill('default' as SeatMode));
//       setOrderingConfig({
//         direction: 'counter-clockwise',
//         pattern: 'sequential',
//         startPosition: 0,
//         mode: 'auto',
//       });
//       setCurrentTab('basic');
//       setResetKey((prev) => prev + 1);
//     }
//   }, [open, editTemplate, initialSessionType]);

//   // ============================================================================
//   // HANDLERS
//   // ============================================================================

//   const handleSessionTypeToggle = (type: EventType) => {
//     setSelectedSessionTypes((prev) => {
//       if (prev.includes(type)) {
//         return prev.filter((t) => t !== type);
//       }
//       return [...prev, type];
//     });
//   };

//   const handleOrderingChange = useCallback((ordering: number[]) => {
//     setSeatOrdering(ordering);
//   }, []);

//   const handleOrderingConfigChange = useCallback((config: {
//     direction: Direction;
//     pattern: OrderingPattern;
//     startPosition: number;
//     mode: OrderingMode;
//   }) => {
//     setOrderingConfig(config);
//   }, []);

//   const handleModesChange = useCallback((modes: SeatMode[]) => {
//     setSeatModes(modes);
//   }, []);

//   const handleSave = () => {
//     if (!isValid) return;

//     // Build the enhanced pattern from current modes
//     const enhancedPattern = createPatternFromModes(seatModes);

//     const template: CreateTemplateInput = {
//       name: name.trim(),
//       description: description.trim(),
//       sessionTypes: selectedSessionTypes,
//       isUserCreated: true,
//       color: SESSION_TYPE_COLORS[selectedSessionTypes[0]] || '#666',
//       baseConfig: {
//         type: tableType,
//         baseSeatCount: tableType === 'round' ? roundSeatCount : undefined,
//         baseSeats: tableType === 'rectangle' ? rectangleSeats : undefined,
//         growthSides: tableType === 'rectangle' ? growthSides : undefined,
//       },
//       orderingDirection: orderingConfig.direction,
//       orderingPattern: orderingConfig.pattern,
//       startPosition: orderingConfig.startPosition,
//       seatModePattern: enhancedPattern,
//       minSeats,
//       maxSeats,
//     };

//     onSave(template);
//     onClose();
//   };

//   const handleClose = () => {
//     onClose();
//   };

//   // ============================================================================
//   // RENDER
//   // ============================================================================

//   return (
//     <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
//       <DialogTitle>
//         <Stack direction="row" alignItems="center" justifyContent="space-between">
//           <Typography variant="h6">
//             {isEditing ? 'Edit Template' : 'Create New Template'}
//           </Typography>
//         </Stack>
//       </DialogTitle>

//       {/* Tabs */}
//       <Tabs
//         value={currentTab}
//         onChange={(_, v) => setCurrentTab(v)}
//         sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
//       >
//         <Tab label="1. Basic Info" value="basic" />
//         <Tab label="2. Ordering" value="ordering" disabled={validationErrors.includes('Template name is required')} />
//         <Tab label="3. Seat Modes" value="modes" disabled={validationErrors.includes('Template name is required')} />
//         <Tab label="4. Preview" value="preview" disabled={!isValid} />
//       </Tabs>

//       <DialogContent sx={{ minHeight: 500 }}>
//         {/* ============ BASIC INFO TAB ============ */}
//         {currentTab === 'basic' && (
//           <Stack spacing={3} sx={{ mt: 2 }}>
//             <TextField
//               label="Template Name"
//               value={name}
//               onChange={(e) => setName(e.target.value)}
//               required
//               error={!name.trim()}
//               helperText={!name.trim() ? 'Required' : ''}
//               fullWidth
//             />

//             <TextField
//               label="Description"
//               value={description}
//               onChange={(e) => setDescription(e.target.value)}
//               multiline
//               rows={2}
//               fullWidth
//             />

//             {/* Session Types */}
//             <Box>
//               <Typography variant="subtitle2" gutterBottom>
//                 Recommended for Session Types *
//               </Typography>
//               <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
//                 {(['Executive meeting', 'Bilateral Meeting', 'Meal', 'Phototaking'] as EventType[]).map((type) => (
//                   <Chip
//                     key={type}
//                     label={type}
//                     onClick={() => handleSessionTypeToggle(type)}
//                     sx={{
//                       bgcolor: selectedSessionTypes.includes(type) ? SESSION_TYPE_COLORS[type] : 'transparent',
//                       color: selectedSessionTypes.includes(type) ? 'white' : 'text.primary',
//                       borderColor: SESSION_TYPE_COLORS[type],
//                     }}
//                     variant={selectedSessionTypes.includes(type) ? 'filled' : 'outlined'}
//                   />
//                 ))}
//               </Stack>
//               {selectedSessionTypes.length === 0 && (
//                 <Typography variant="caption" color="error">
//                   Select at least one session type
//                 </Typography>
//               )}
//             </Box>

//             <Divider />

//             {/* Table Type */}
//             <Box>
//               <Typography variant="subtitle2" gutterBottom>
//                 Table Type
//               </Typography>
//               <ToggleButtonGroup
//                 value={tableType}
//                 exclusive
//                 onChange={(_, v) => v && setTableType(v)}
//               >
//                 <ToggleButton value="round">
//                   <Circle sx={{ mr: 1 }} /> Round
//                 </ToggleButton>
//                 <ToggleButton value="rectangle">
//                   <Rectangle sx={{ mr: 1 }} /> Rectangle
//                 </ToggleButton>
//               </ToggleButtonGroup>
//             </Box>

//             {/* Seat Configuration */}
//             {tableType === 'round' ? (
//               <Box>
//                 <Typography variant="subtitle2" gutterBottom>
//                   Base Seat Count: {roundSeatCount}
//                 </Typography>
//                 <Slider
//                   value={roundSeatCount}
//                   onChange={(_, v) => setRoundSeatCount(v as number)}
//                   min={4}
//                   max={20}
//                   marks
//                   valueLabelDisplay="auto"
//                 />
//               </Box>
//             ) : (
//               <Stack spacing={2}>
//                 <Typography variant="subtitle2">Seats per Side</Typography>
//                 <Stack direction="row" spacing={2}>
//                   <TextField
//                     label="Top"
//                     type="number"
//                     value={rectangleSeats.top}
//                     onChange={(e) => setRectangleSeats((prev) => ({ ...prev, top: Math.max(0, parseInt(e.target.value) || 0) }))}
//                     inputProps={{ min: 0 }}
//                     size="small"
//                   />
//                   <TextField
//                     label="Bottom"
//                     type="number"
//                     value={rectangleSeats.bottom}
//                     onChange={(e) => setRectangleSeats((prev) => ({ ...prev, bottom: Math.max(0, parseInt(e.target.value) || 0) }))}
//                     inputProps={{ min: 0 }}
//                     size="small"
//                   />
//                   <TextField
//                     label="Left"
//                     type="number"
//                     value={rectangleSeats.left}
//                     onChange={(e) => setRectangleSeats((prev) => ({ ...prev, left: Math.max(0, parseInt(e.target.value) || 0) }))}
//                     inputProps={{ min: 0 }}
//                     size="small"
//                   />
//                   <TextField
//                     label="Right"
//                     type="number"
//                     value={rectangleSeats.right}
//                     onChange={(e) => setRectangleSeats((prev) => ({ ...prev, right: Math.max(0, parseInt(e.target.value) || 0) }))}
//                     inputProps={{ min: 0 }}
//                     size="small"
//                   />
//                 </Stack>

//                 <Typography variant="subtitle2">Growth Sides (which sides expand when adding seats)</Typography>
//                 <FormGroup row>
//                   <FormControlLabel
//                     control={<Checkbox checked={growthSides.top} onChange={(e) => setGrowthSides((prev) => ({ ...prev, top: e.target.checked }))} />}
//                     label="Top"
//                   />
//                   <FormControlLabel
//                     control={<Checkbox checked={growthSides.bottom} onChange={(e) => setGrowthSides((prev) => ({ ...prev, bottom: e.target.checked }))} />}
//                     label="Bottom"
//                   />
//                   <FormControlLabel
//                     control={<Checkbox checked={growthSides.left} onChange={(e) => setGrowthSides((prev) => ({ ...prev, left: e.target.checked }))} />}
//                     label="Left"
//                   />
//                   <FormControlLabel
//                     control={<Checkbox checked={growthSides.right} onChange={(e) => setGrowthSides((prev) => ({ ...prev, right: e.target.checked }))} />}
//                     label="Right"
//                   />
//                 </FormGroup>
//               </Stack>
//             )}

//             {/* Scaling Limits */}
//             <Stack direction="row" spacing={2}>
//               <TextField
//                 label="Min Seats"
//                 type="number"
//                 value={minSeats}
//                 onChange={(e) => setMinSeats(Math.max(2, parseInt(e.target.value) || 2))}
//                 inputProps={{ min: 2, max: baseSeatCount }}
//                 size="small"
//                 sx={{ width: 120 }}
//               />
//               <TextField
//                 label="Max Seats"
//                 type="number"
//                 value={maxSeats}
//                 onChange={(e) => setMaxSeats(Math.max(baseSeatCount, parseInt(e.target.value) || baseSeatCount))}
//                 inputProps={{ min: baseSeatCount }}
//                 size="small"
//                 sx={{ width: 120 }}
//               />
//             </Stack>

//             <Typography variant="caption" color="text.secondary">
//               Total base seats: {baseSeatCount}
//             </Typography>
//           </Stack>
//         )}

//         {/* ============ ORDERING TAB - Uses SeatOrderingPanel ============ */}
//         {currentTab === 'ordering' && (
//           <Box sx={{ mt: 2 }}>
//             <SeatOrderingPanel
//               tableType={tableType}
//               roundSeats={tableType === 'round' ? roundSeatCount : undefined}
//               rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
//               seatModes={seatModes}
//               initialDirection={orderingConfig.direction}
//               initialPattern={orderingConfig.pattern}
//               initialStartPosition={orderingConfig.startPosition}
//               onOrderingChange={handleOrderingChange}
//               onOrderingConfigChange={handleOrderingConfigChange}
//               previewSize="large"
//               maxPreviewHeight={400}
//               showModeToggle={true}
//               resetKey={resetKey}
//             />
//           </Box>
//         )}

//         {/* ============ MODES TAB - Uses SeatModePanel ============ */}
//         {currentTab === 'modes' && (
//           <Stack spacing={3} sx={{ mt: 2 }}>
//             <Alert severity="info">
//               Configure the seat mode pattern. The system will intelligently scale this pattern when
//               the table size is adjusted between {minSeats} and {maxSeats} seats.
//             </Alert>

//             <SeatModePanel
//               tableType={tableType}
//               roundSeats={tableType === 'round' ? roundSeatCount : undefined}
//               rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
//               seatOrdering={seatOrdering}
//               seatModes={seatModes}
//               onModesChange={handleModesChange}
//               previewSize="large"
//               maxPreviewHeight={350}
//               showResetButton={true}
//               resetKey={resetKey}
//             />

//             {/* Pattern Detection Info */}
//             <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
//               <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
//                 <Box sx={{ flex: 1, minWidth: 200 }}>
//                   <Typography variant="subtitle2" fontWeight="bold">
//                     Detected Pattern: {detectedPattern.description}
//                   </Typography>
//                   <Typography variant="caption" color="text.secondary">
//                     Pattern string: {modesToString(seatModes)}
//                   </Typography>
//                 </Box>
//                 <Chip
//                   label={`Confidence: ${Math.round(detectedPattern.confidence * 100)}%`}
//                   size="small"
//                   color={detectedPattern.confidence > 0.9 ? 'success' : 'warning'}
//                 />
//               </Stack>
//             </Paper>
//           </Stack>
//         )}

//         {/* ============ PREVIEW TAB ============ */}
//         {currentTab === 'preview' && (
//           <Stack spacing={3} sx={{ mt: 2 }}>
//             <Alert severity="success" icon={<Check />}>
//               Template configuration complete! Review your template below.
//             </Alert>

//             <Paper elevation={0} sx={{ p: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
//               <Typography variant="h6" gutterBottom>
//                 {name || 'Unnamed Template'}
//               </Typography>
//               <Typography variant="body2" color="text.secondary" paragraph>
//                 {description || 'No description'}
//               </Typography>

//               <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
//                 {selectedSessionTypes.map((type) => (
//                   <Chip
//                     key={type}
//                     label={type}
//                     size="small"
//                     sx={{ bgcolor: SESSION_TYPE_COLORS[type], color: 'white' }}
//                   />
//                 ))}
//               </Stack>

//               <Divider sx={{ my: 2 }} />

//               <Stack spacing={1}>
//                 <Typography variant="body2">
//                   <strong>Type:</strong> {tableType === 'round' ? 'Round' : 'Rectangle'} table
//                 </Typography>
//                 <Typography variant="body2">
//                   <strong>Base seats:</strong> {baseSeatCount}
//                 </Typography>
//                 <Typography variant="body2">
//                   <strong>Scaling range:</strong> {minSeats} - {maxSeats} seats
//                 </Typography>
//                 <Typography variant="body2">
//                   <strong>Direction:</strong> {orderingConfig.direction}
//                 </Typography>
//                 <Typography variant="body2">
//                   <strong>Ordering:</strong> {orderingConfig.pattern}
//                 </Typography>
//                 <Typography variant="body2">
//                   <strong>Pattern:</strong> {detectedPattern.description}
//                 </Typography>
//               </Stack>
//             </Paper>

//             {/* Preview at base size */}
//             <Paper elevation={0} sx={{ p: 3, bgcolor: '#e3f2fd', borderRadius: 2 }}>
//               <Typography variant="subtitle2" gutterBottom>
//                 Preview at {baseSeatCount} seats (base configuration):
//               </Typography>
//               <ScrollablePreviewContainer bgcolor="white" maxHeight={350} minHeight={280}>
//                 <TablePreview
//                   type={tableType}
//                   roundSeats={tableType === 'round' ? roundSeatCount : undefined}
//                   rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
//                   seatOrdering={seatOrdering}
//                   seatModes={seatModes}
//                   size="large"
//                   showLabels
//                 />
//               </ScrollablePreviewContainer>
//             </Paper>

//             {/* Preview at max size */}
//             {maxSeats > baseSeatCount && (
//               <Paper elevation={0} sx={{ p: 3, bgcolor: '#fff3e0', borderRadius: 2 }}>
//                 <Typography variant="subtitle2" gutterBottom>
//                   Preview at {maxSeats} seats (maximum):
//                 </Typography>
//                 <ScrollablePreviewContainer bgcolor="white" maxHeight={350} minHeight={280}>
//                   {(() => {
//                     const scaledModes = scalePattern(detectedPattern, maxSeats);
//                     const scaledOrdering = generateOrdering(
//                       maxSeats,
//                       orderingConfig.direction,
//                       orderingConfig.pattern,
//                       orderingConfig.startPosition,
//                       tableType === 'rectangle' ? rectangleSeats : undefined
//                     );
//                     return (
//                       <TablePreview
//                         type={tableType}
//                         roundSeats={tableType === 'round' ? maxSeats : undefined}
//                         rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
//                         seatOrdering={scaledOrdering}
//                         seatModes={scaledModes}
//                         size="large"
//                         showLabels
//                       />
//                     );
//                   })()}
//                 </ScrollablePreviewContainer>
//                 <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
//                   Pattern: {modesToString(scalePattern(detectedPattern, maxSeats))}
//                 </Typography>
//               </Paper>
//             )}
//           </Stack>
//         )}
//       </DialogContent>

//       <DialogActions sx={{ px: 3, py: 2 }}>
//         <Button onClick={handleClose}>Cancel</Button>

//         {currentTab !== 'preview' && (
//           <Button
//             variant="outlined"
//             onClick={() => {
//               const tabs: TabValue[] = ['basic', 'ordering', 'modes', 'preview'];
//               const currentIndex = tabs.indexOf(currentTab);
//               if (currentIndex < tabs.length - 1) {
//                 setCurrentTab(tabs[currentIndex + 1]);
//               }
//             }}
//             disabled={currentTab === 'basic' && !isValid}
//           >
//             Next
//           </Button>
//         )}

//         {currentTab === 'preview' && (
//           <Button variant="contained" onClick={handleSave} disabled={!isValid}>
//             {isEditing ? 'Save Changes' : 'Create Template'}
//           </Button>
//         )}
//       </DialogActions>
//     </Dialog>
//   );
// }