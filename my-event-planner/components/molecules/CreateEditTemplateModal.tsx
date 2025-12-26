// components/molecules/CreateEditTemplateModal.tsx
// ENHANCED: Modal for creating/editing table templates with intelligent pattern system
// UPDATED: Removed seat limits, added scrollable preview areas for large tables

'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  Box,
  Paper,
  Chip,
  Divider,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  FormGroup,
  Checkbox,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Refresh,
  Circle,
  Rectangle,
  RotateLeft,
  RotateRight,
  FilterList,
  Check,
  Warning,
} from '@mui/icons-material';
import { SeatMode } from '@/types/Seat';
import { EventType } from '@/types/Event';
import {
  TableTemplate,
  Direction,
  OrderingPattern,
  CreateTemplateInput,
  EnhancedSeatModePattern,
  isEnhancedPattern,
  SESSION_TYPE_COLORS,
} from '@/types/Template';
import {
  generateOrdering,
  validateTemplate,
  getTemplateBaseSeatCount,
  createPatternFromModes,
} from '@/utils/templateScaler';
import { detectPattern, getPatternSummary } from '@/utils/patternDetector';
import { scalePattern, modesToString } from '@/utils/patternScaler';
import TablePreview from '../atoms/TablePreview';
import PatternEditor from './PatternEditor';
import SeatOrderingControls, { PatternPreview } from './SeatOrderingControls';

// ============================================================================
// TYPES
// ============================================================================

interface CreateEditTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (template: CreateTemplateInput) => void;
  editTemplate?: TableTemplate | null;
  initialSessionType?: EventType | null;
}

type TabValue = 'basic' | 'ordering' | 'pattern' | 'preview';

// ============================================================================
// SCROLLABLE PREVIEW CONTAINER - Key component for large tables
// ============================================================================

interface ScrollablePreviewContainerProps {
  children: React.ReactNode;
  bgcolor?: string;
  maxHeight?: number;
}

function ScrollablePreviewContainer({ 
  children, 
  bgcolor = '#fafafa',
  maxHeight = 400,
}: ScrollablePreviewContainerProps) {
  return (
    <Box
      sx={{
        bgcolor,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        maxHeight,
        overflow: 'auto',
        // These are critical for scrolling to work properly
        '& > *': {
          display: 'block',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          // Allow the content to define its own size
          minWidth: 'max-content',
          minHeight: 'max-content',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateEditTemplateModal({
  open,
  onClose,
  onSave,
  editTemplate = null,
  initialSessionType = null,
}: CreateEditTemplateModalProps) {
  const isEditing = !!editTemplate;
  
  // Current tab
  const [currentTab, setCurrentTab] = useState<TabValue>('basic');

  // ============================================================================
  // BASIC INFO STATE
  // ============================================================================
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSessionTypes, setSelectedSessionTypes] = useState<EventType[]>([]);
  const [tableType, setTableType] = useState<'round' | 'rectangle'>('round');

  // ============================================================================
  // SEAT COUNT STATE
  // ============================================================================
  
  const [roundSeatCount, setRoundSeatCount] = useState(8);
  const [rectangleSeats, setRectangleSeats] = useState({ top: 3, bottom: 3, left: 1, right: 1 });
  const [growthSides, setGrowthSides] = useState({ top: true, bottom: true, left: false, right: false });
  const [minSeats, setMinSeats] = useState(4);
  const [maxSeats, setMaxSeats] = useState(16);

  // ============================================================================
  // ORDERING STATE
  // ============================================================================
  
  const [direction, setDirection] = useState<Direction>('counter-clockwise');
  const [orderingPattern, setOrderingPattern] = useState<OrderingPattern>('sequential');
  const [startPosition, setStartPosition] = useState(0);

  // ============================================================================
  // PATTERN STATE (NEW ENHANCED SYSTEM)
  // ============================================================================
  
  const [seatModes, setSeatModes] = useState<SeatMode[]>([]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const baseSeatCount = useMemo(() => {
    if (tableType === 'round') return roundSeatCount;
    return rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
  }, [tableType, roundSeatCount, rectangleSeats]);

  const seatOrdering = useMemo(() => {
    const config = tableType === 'rectangle' ? rectangleSeats : undefined;
    return generateOrdering(baseSeatCount, direction, orderingPattern, startPosition, config);
  }, [baseSeatCount, direction, orderingPattern, startPosition, tableType, rectangleSeats]);

  const detectedPattern = useMemo(() => {
    return detectPattern(seatModes);
  }, [seatModes]);

  const validationErrors = useMemo(() => {
    const template: Partial<TableTemplate> = {
      name,
      sessionTypes: selectedSessionTypes,
      baseConfig: {
        type: tableType,
        baseSeatCount: tableType === 'round' ? roundSeatCount : undefined,
        baseSeats: tableType === 'rectangle' ? rectangleSeats : undefined,
        growthSides: tableType === 'rectangle' ? growthSides : undefined,
      },
      minSeats,
      maxSeats,
    };
    return validateTemplate(template);
  }, [name, selectedSessionTypes, tableType, roundSeatCount, rectangleSeats, growthSides, minSeats, maxSeats]);

  const isValid = validationErrors.length === 0;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize seat modes when seat count changes
  useEffect(() => {
    setSeatModes(prev => {
      if (prev.length === baseSeatCount) return prev;
      
      // If we have existing modes, scale them using the pattern system
      if (prev.length > 0) {
        const pattern = detectPattern(prev);
        return scalePattern(pattern, baseSeatCount);
      }
      
      // Initialize with all default
      return Array(baseSeatCount).fill('default' as SeatMode);
    });
  }, [baseSeatCount]);

  // Reset start position if it exceeds seat count
  useEffect(() => {
    if (startPosition >= baseSeatCount) {
      setStartPosition(0);
    }
  }, [baseSeatCount, startPosition]);

  // Load existing template data when editing
  useEffect(() => {
    if (editTemplate) {
      setName(editTemplate.name);
      setDescription(editTemplate.description);
      setSelectedSessionTypes([...editTemplate.sessionTypes]);
      setTableType(editTemplate.baseConfig.type);
      setMinSeats(editTemplate.minSeats);
      setMaxSeats(editTemplate.maxSeats);
      setDirection(editTemplate.orderingDirection);
      setOrderingPattern(editTemplate.orderingPattern);
      setStartPosition(editTemplate.startPosition);

      if (editTemplate.baseConfig.type === 'round') {
        setRoundSeatCount(editTemplate.baseConfig.baseSeatCount || 8);
      } else {
        setRectangleSeats(editTemplate.baseConfig.baseSeats || { top: 3, bottom: 3, left: 1, right: 1 });
        setGrowthSides(editTemplate.baseConfig.growthSides || { top: true, bottom: true, left: false, right: false });
      }

      // Load pattern
      if (isEnhancedPattern(editTemplate.seatModePattern)) {
        setSeatModes([...editTemplate.seatModePattern.baseModes]);
      } else {
        // Convert legacy pattern to modes
        const baseCount = getTemplateBaseSeatCount(editTemplate);
        const modes: SeatMode[] = [];
        const pattern = editTemplate.seatModePattern;
        
        if (pattern.type === 'repeating' && pattern.pattern) {
          for (let i = 0; i < baseCount; i++) {
            modes.push(pattern.pattern[i % pattern.pattern.length]);
          }
        } else if (pattern.type === 'alternating' && pattern.alternatingModes) {
          for (let i = 0; i < baseCount; i++) {
            modes.push(pattern.alternatingModes[i % 2]);
          }
        } else if (pattern.type === 'specific') {
          for (let i = 0; i < baseCount; i++) {
            modes.push(pattern.specificModes?.[i] || pattern.defaultMode);
          }
        } else {
          for (let i = 0; i < baseCount; i++) {
            modes.push(pattern.defaultMode);
          }
        }
        
        setSeatModes(modes);
      }
    }
  }, [editTemplate]);

  // Reset form when modal opens for new template
  useEffect(() => {
    if (open && !editTemplate) {
      setName('');
      setDescription('');
      setSelectedSessionTypes(initialSessionType ? [initialSessionType] : []);
      setTableType('round');
      setRoundSeatCount(8);
      setRectangleSeats({ top: 3, bottom: 3, left: 1, right: 1 });
      setGrowthSides({ top: true, bottom: true, left: false, right: false });
      setMinSeats(4);
      setMaxSeats(16);
      setDirection('counter-clockwise');
      setOrderingPattern('sequential');
      setStartPosition(0);
      setSeatModes(Array(8).fill('default' as SeatMode));
      setCurrentTab('basic');
    }
  }, [open, editTemplate, initialSessionType]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSessionTypeToggle = (type: EventType) => {
    setSelectedSessionTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleSave = () => {
    if (!isValid) return;

    // Build the enhanced pattern from current modes
    const enhancedPattern = createPatternFromModes(seatModes);

    const template: CreateTemplateInput = {
      name: name.trim(),
      description: description.trim(),
      sessionTypes: selectedSessionTypes,
      isUserCreated: true,
      color: SESSION_TYPE_COLORS[selectedSessionTypes[0]] || '#666',
      baseConfig: {
        type: tableType,
        baseSeatCount: tableType === 'round' ? roundSeatCount : undefined,
        baseSeats: tableType === 'rectangle' ? rectangleSeats : undefined,
        growthSides: tableType === 'rectangle' ? growthSides : undefined,
      },
      orderingDirection: direction,
      orderingPattern: orderingPattern,
      startPosition,
      seatModePattern: enhancedPattern,
      minSeats,
      maxSeats,
    };

    onSave(template);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditing ? 'Edit Template' : 'Create New Template'}
      </DialogTitle>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onChange={(_, v) => setCurrentTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label="1. Basic Info" value="basic" />
        <Tab label="2. Ordering" value="ordering" disabled={validationErrors.includes('Template name is required')} />
        <Tab label="3. Seat Modes" value="pattern" disabled={validationErrors.includes('Template name is required')} />
        <Tab label="4. Preview" value="preview" disabled={!isValid} />
      </Tabs>

      <DialogContent sx={{ minHeight: 500 }}>
        {/* ============ BASIC INFO TAB ============ */}
        {currentTab === 'basic' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Template Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              error={!name.trim()}
              helperText={!name.trim() ? 'Required' : ''}
              fullWidth
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            {/* Session Types */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Recommended for Session Types *
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(['Executive meeting', 'Bilateral Meeting', 'Meal', 'Phototaking'] as EventType[]).map(type => (
                  <Chip
                    key={type}
                    label={type}
                    onClick={() => handleSessionTypeToggle(type)}
                    sx={{
                      bgcolor: selectedSessionTypes.includes(type) ? SESSION_TYPE_COLORS[type] : 'transparent',
                      color: selectedSessionTypes.includes(type) ? 'white' : 'text.primary',
                      borderColor: SESSION_TYPE_COLORS[type],
                    }}
                    variant={selectedSessionTypes.includes(type) ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
              {selectedSessionTypes.length === 0 && (
                <Typography variant="caption" color="error">
                  Select at least one session type
                </Typography>
              )}
            </Box>

            <Divider />

            {/* Table Type */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Table Type
              </Typography>
              <ToggleButtonGroup
                value={tableType}
                exclusive
                onChange={(_, v) => v && setTableType(v)}
              >
                <ToggleButton value="round">
                  <Circle sx={{ mr: 1 }} /> Round
                </ToggleButton>
                <ToggleButton value="rectangle">
                  <Rectangle sx={{ mr: 1 }} /> Rectangle
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Seat Configuration */}
            {tableType === 'round' ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Base Seat Count: {roundSeatCount}
                </Typography>
                <Slider
                  value={roundSeatCount}
                  onChange={(_, v) => setRoundSeatCount(v as number)}
                  min={4}
                  max={20}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>
            ) : (
              <Stack spacing={2}>
                <Typography variant="subtitle2">Seats per Side (no limit)</Typography>
                <Stack direction="row" spacing={2}>
                  {/* UPDATED: Removed max limits on all sides */}
                  <TextField
                    label="Top"
                    type="number"
                    value={rectangleSeats.top}
                    onChange={(e) => setRectangleSeats(prev => ({ ...prev, top: Math.max(0, parseInt(e.target.value) || 0) }))}
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <TextField
                    label="Bottom"
                    type="number"
                    value={rectangleSeats.bottom}
                    onChange={(e) => setRectangleSeats(prev => ({ ...prev, bottom: Math.max(0, parseInt(e.target.value) || 0) }))}
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <TextField
                    label="Left"
                    type="number"
                    value={rectangleSeats.left}
                    onChange={(e) => setRectangleSeats(prev => ({ ...prev, left: Math.max(0, parseInt(e.target.value) || 0) }))}
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                  <TextField
                    label="Right"
                    type="number"
                    value={rectangleSeats.right}
                    onChange={(e) => setRectangleSeats(prev => ({ ...prev, right: Math.max(0, parseInt(e.target.value) || 0) }))}
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                </Stack>

                <Typography variant="subtitle2">Growth Sides (which sides expand when adding seats)</Typography>
                <FormGroup row>
                  <FormControlLabel
                    control={<Checkbox checked={growthSides.top} onChange={(e) => setGrowthSides(prev => ({ ...prev, top: e.target.checked }))} />}
                    label="Top"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={growthSides.bottom} onChange={(e) => setGrowthSides(prev => ({ ...prev, bottom: e.target.checked }))} />}
                    label="Bottom"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={growthSides.left} onChange={(e) => setGrowthSides(prev => ({ ...prev, left: e.target.checked }))} />}
                    label="Left"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={growthSides.right} onChange={(e) => setGrowthSides(prev => ({ ...prev, right: e.target.checked }))} />}
                    label="Right"
                  />
                </FormGroup>
              </Stack>
            )}

            {/* Scaling Limits */}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Min Seats"
                type="number"
                value={minSeats}
                onChange={(e) => setMinSeats(Math.max(2, parseInt(e.target.value) || 2))}
                inputProps={{ min: 2, max: baseSeatCount }}
                size="small"
                sx={{ width: 120 }}
              />
              <TextField
                label="Max Seats"
                type="number"
                value={maxSeats}
                onChange={(e) => setMaxSeats(Math.max(baseSeatCount, parseInt(e.target.value) || baseSeatCount))}
                inputProps={{ min: baseSeatCount }}
                size="small"
                sx={{ width: 120 }}
              />
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Total base seats: {baseSeatCount}
            </Typography>
          </Stack>
        )}

        {/* ============ ORDERING TAB ============ */}
        {currentTab === 'ordering' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <SeatOrderingControls
              direction={direction}
              orderingPattern={orderingPattern}
              startPosition={startPosition}
              totalSeats={baseSeatCount}
              onDirectionChange={setDirection}
              onPatternChange={setOrderingPattern}
              showResetButton
              tableType={tableType}
            />

            {/* UPDATED: Scrollable preview container */}
            <ScrollablePreviewContainer bgcolor="#fafafa" maxHeight={400}>
              <TablePreview
                type={tableType}
                roundSeats={tableType === 'round' ? roundSeatCount : undefined}
                rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
                seatOrdering={seatOrdering}
                seatModes={seatModes}
                startPosition={startPosition}
                onSeatClick={(_, index) => setStartPosition(index)}
                interactionMode="ordering"
                size="large"
              />
            </ScrollablePreviewContainer>

            <PatternPreview seatOrdering={seatOrdering} />
          </Stack>
        )}

        {/* ============ PATTERN TAB (NEW) ============ */}
        {currentTab === 'pattern' && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Configure the seat mode pattern. The system will intelligently scale this pattern when
              the table size is adjusted between {minSeats} and {maxSeats} seats.
            </Alert>

            <PatternEditor
              seatModes={seatModes}
              tableType={tableType}
              baseSeatCount={baseSeatCount}
              rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
              seatOrdering={seatOrdering}
              onModesChange={setSeatModes}
              minSeats={minSeats}
              maxSeats={maxSeats}
            />
          </Box>
        )}

        {/* ============ PREVIEW TAB ============ */}
        {currentTab === 'preview' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="success" icon={<Check />}>
              Template configuration complete! Review your template below.
            </Alert>

            <Paper elevation={0} sx={{ p: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                {name || 'Unnamed Template'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {description || 'No description'}
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                {selectedSessionTypes.map(type => (
                  <Chip
                    key={type}
                    label={type}
                    size="small"
                    sx={{ bgcolor: SESSION_TYPE_COLORS[type], color: 'white' }}
                  />
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Type:</strong> {tableType === 'round' ? 'Round' : 'Rectangle'} table
                </Typography>
                <Typography variant="body2">
                  <strong>Base seats:</strong> {baseSeatCount}
                </Typography>
                <Typography variant="body2">
                  <strong>Scaling range:</strong> {minSeats} - {maxSeats} seats
                </Typography>
                <Typography variant="body2">
                  <strong>Direction:</strong> {direction}
                </Typography>
                <Typography variant="body2">
                  <strong>Ordering:</strong> {orderingPattern}
                </Typography>
                <Typography variant="body2">
                  <strong>Pattern:</strong> {detectedPattern.description}
                </Typography>
              </Stack>
            </Paper>

            {/* Preview at base size - UPDATED: Scrollable container */}
            <Paper elevation={0} sx={{ p: 3, bgcolor: '#e3f2fd', borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Preview at {baseSeatCount} seats (base configuration):
              </Typography>
              <ScrollablePreviewContainer bgcolor="white" maxHeight={350}>
                <TablePreview
                  type={tableType}
                  roundSeats={tableType === 'round' ? roundSeatCount : undefined}
                  rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
                  seatOrdering={seatOrdering}
                  seatModes={seatModes}
                  size="large"
                  showLabels
                />
              </ScrollablePreviewContainer>
            </Paper>

            {/* Preview at max size - UPDATED: Scrollable container */}
            {maxSeats > baseSeatCount && (
              <Paper elevation={0} sx={{ p: 3, bgcolor: '#fff3e0', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview at {maxSeats} seats (maximum):
                </Typography>
                <ScrollablePreviewContainer bgcolor="white" maxHeight={350}>
                  {(() => {
                    const scaledModes = scalePattern(detectedPattern, maxSeats);
                    const scaledOrdering = generateOrdering(
                      maxSeats,
                      direction,
                      orderingPattern,
                      startPosition,
                      tableType === 'rectangle' ? rectangleSeats : undefined
                    );
                    return (
                      <TablePreview
                        type={tableType}
                        roundSeats={tableType === 'round' ? maxSeats : undefined}
                        rectangleSeats={tableType === 'rectangle' ? rectangleSeats : undefined}
                        seatOrdering={scaledOrdering}
                        seatModes={scaledModes}
                        size="large"
                        showLabels
                      />
                    );
                  })()}
                </ScrollablePreviewContainer>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                  Pattern: {modesToString(scalePattern(detectedPattern, maxSeats))}
                </Typography>
              </Paper>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        
        {currentTab !== 'preview' && (
          <Button
            variant="outlined"
            onClick={() => {
              const tabs: TabValue[] = ['basic', 'ordering', 'pattern', 'preview'];
              const currentIndex = tabs.indexOf(currentTab);
              if (currentIndex < tabs.length - 1) {
                setCurrentTab(tabs[currentIndex + 1]);
              }
            }}
            disabled={currentTab === 'basic' && !isValid}
          >
            Next
          </Button>
        )}
        
        {currentTab === 'preview' && (
          <Button variant="contained" onClick={handleSave} disabled={!isValid}>
            {isEditing ? 'Save Changes' : 'Create Template'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}