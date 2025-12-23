// components/molecules/CreateEditTemplateModal.tsx
// Modal for creating and editing table templates
// Reuses the same configuration components as AddTableModal

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  Slider,
} from '@mui/material';
import { Save, Close } from '@mui/icons-material';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';
import { EventType } from '@/types/Event';
import {
  TableTemplate,
  CreateTemplateInput,
  Direction,
  OrderingPattern,
  SeatModePattern,
  RectangleGrowthConfig,
  SESSION_TYPE_COLORS,
} from '@/types/Template';
import {
  generateOrdering,
  generateSeatModes,
  scaleRectangleSeats,
  validateTemplate,
  getTemplateBaseSeatCount,
} from '@/utils/templateScaler';
import SeatOrderingControls, { PatternPreview } from './SeatOrderingControls';
import SeatModeControls, { SeatModeLegend, SeatModeMenu } from './SeatModeControls';
import TablePreview from '../atoms/TablePreview';

// ============================================================================
// TYPES
// ============================================================================

type TabValue = 'basic' | 'config' | 'ordering' | 'modes' | 'scaling';

interface CreateEditTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (template: CreateTemplateInput) => void;
  editTemplate?: TableTemplate | null; // null = create mode
  initialSessionType?: EventType | null;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

const ALL_SESSION_TYPES: EventType[] = [
  'Executive meeting',
  'Bilateral Meeting',
  'Meal',
  'Phototaking',
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateEditTemplateModal({
  open,
  onClose,
  onSave,
  editTemplate,
  initialSessionType,
}: CreateEditTemplateModalProps) {
  const isEditMode = Boolean(editTemplate);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>('basic');

  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sessionTypes, setSessionTypes] = useState<EventType[]>([]);

  // Table configuration
  const [tableType, setTableType] = useState<'round' | 'rectangle'>('round');
  const [roundSeats, setRoundSeats] = useState(8);
  const [rectangleSeats, setRectangleSeats] = useState({
    top: 2,
    bottom: 2,
    left: 1,
    right: 1,
  });
  const [growthSides, setGrowthSides] = useState<RectangleGrowthConfig>({
    top: true,
    bottom: true,
    left: false,
    right: false,
  });

  // Ordering configuration
  const [direction, setDirection] = useState<Direction>('counter-clockwise');
  const [orderingPattern, setOrderingPattern] = useState<OrderingPattern>('sequential');
  const [startPosition, setStartPosition] = useState(0);

  // Seat modes
  const [seatModes, setSeatModes] = useState<SeatMode[]>([]);
  const [modeMenuAnchor, setModeMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);

  // Scaling limits
  const [minSeats, setMinSeats] = useState(4);
  const [maxSeats, setMaxSeats] = useState(20);

  // Validation
  const [errors, setErrors] = useState<string[]>([]);

  // Calculate total seats
  const totalSeats = useMemo(() => {
    if (tableType === 'round') {
      return roundSeats;
    }
    return rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
  }, [tableType, roundSeats, rectangleSeats]);

  // Generate ordering
  const seatOrdering = useMemo(() => {
    const rectangleConfig = tableType === 'rectangle' ? rectangleSeats : undefined;
    return generateOrdering(totalSeats, direction, orderingPattern, startPosition, rectangleConfig);
  }, [totalSeats, direction, orderingPattern, startPosition, tableType, rectangleSeats]);

  // Initialize/reset form
  useEffect(() => {
    if (open) {
      if (editTemplate) {
        // Edit mode - populate from template
        setName(editTemplate.name);
        setDescription(editTemplate.description);
        setSessionTypes([...editTemplate.sessionTypes]);
        setTableType(editTemplate.baseConfig.type);
        
        if (editTemplate.baseConfig.type === 'round') {
          setRoundSeats(editTemplate.baseConfig.baseSeatCount || 8);
        } else {
          setRectangleSeats(editTemplate.baseConfig.baseSeats || {
            top: 2, bottom: 2, left: 1, right: 1
          });
          setGrowthSides(editTemplate.baseConfig.growthSides || {
            top: true, bottom: true, left: false, right: false
          });
        }

        setDirection(editTemplate.orderingDirection);
        setOrderingPattern(editTemplate.orderingPattern);
        setStartPosition(editTemplate.startPosition);
        setMinSeats(editTemplate.minSeats);
        setMaxSeats(editTemplate.maxSeats);

        // Generate seat modes from pattern
        const baseSeatCount = getTemplateBaseSeatCount(editTemplate);
        setSeatModes(generateSeatModes(editTemplate.seatModePattern, baseSeatCount));
      } else {
        // Create mode - reset to defaults
        setName('');
        setDescription('');
        setSessionTypes(initialSessionType ? [initialSessionType] : []);
        setTableType('round');
        setRoundSeats(8);
        setRectangleSeats({ top: 2, bottom: 2, left: 1, right: 1 });
        setGrowthSides({ top: true, bottom: true, left: false, right: false });
        setDirection('counter-clockwise');
        setOrderingPattern('sequential');
        setStartPosition(0);
        setMinSeats(4);
        setMaxSeats(20);
        setSeatModes(Array(8).fill('default'));
      }

      setActiveTab('basic');
      setErrors([]);
    }
  }, [open, editTemplate, initialSessionType]);

  // Update seat modes when seat count changes
  useEffect(() => {
    setSeatModes((prev) => {
      if (prev.length === totalSeats) return prev;
      if (totalSeats > prev.length) {
        return [...prev, ...Array(totalSeats - prev.length).fill('default')];
      }
      return prev.slice(0, totalSeats);
    });
  }, [totalSeats]);

  // Reset start position when seat count changes
  useEffect(() => {
    if (startPosition >= totalSeats) {
      setStartPosition(0);
    }
  }, [totalSeats, startPosition]);

  // Mode counts for summary
  const modeCounts = useMemo(() => {
    const counts: Record<SeatMode, number> = {
      'default': 0,
      'host-only': 0,
      'external-only': 0,
    };
    seatModes.forEach((mode) => {
      counts[mode]++;
    });
    return counts;
  }, [seatModes]);

  // Session type toggle
  const handleSessionTypeToggle = (type: EventType) => {
    setSessionTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  // Growth side toggle
  const handleGrowthSideToggle = (side: keyof RectangleGrowthConfig) => {
    setGrowthSides((prev) => ({
      ...prev,
      [side]: !prev[side],
    }));
  };

  // Seat click handler
  const handleSeatClick = (event: React.MouseEvent, index: number) => {
    if (activeTab === 'ordering') {
      setStartPosition(index);
    } else if (activeTab === 'modes') {
      setModeMenuAnchor(event.currentTarget as HTMLElement);
      setSelectedSeatIndex(index);
    }
  };

  // Mode menu handlers
  const handleModeMenuClose = () => {
    setModeMenuAnchor(null);
    setSelectedSeatIndex(null);
  };

  const handleModeSelect = (mode: SeatMode) => {
    if (selectedSeatIndex !== null) {
      setSeatModes((prev) => {
        const newModes = [...prev];
        newModes[selectedSeatIndex] = mode;
        return newModes;
      });
    }
    handleModeMenuClose();
  };

  // Set all modes
  const handleSetAllModes = (mode: SeatMode) => {
    setSeatModes(Array(totalSeats).fill(mode));
  };

  // Reset ordering
  const handleResetOrdering = () => {
    setDirection('counter-clockwise');
    setOrderingPattern('sequential');
    setStartPosition(0);
  };

  // Build template object
  const buildTemplate = useCallback((): CreateTemplateInput => {
    // Convert seat modes array to pattern
    const seatModePattern: SeatModePattern = {
      type: 'specific',
      specificModes: seatModes.reduce((acc, mode, idx) => {
        if (mode !== 'default') {
          acc[idx] = mode;
        }
        return acc;
      }, {} as Record<number, SeatMode>),
      defaultMode: 'default',
    };

    return {
      name: name.trim(),
      description: description.trim(),
      sessionTypes,
      isUserCreated: true,
      color: sessionTypes.length > 0 ? SESSION_TYPE_COLORS[sessionTypes[0]] : '#666666',
      baseConfig: {
        type: tableType,
        baseSeatCount: tableType === 'round' ? roundSeats : undefined,
        baseSeats: tableType === 'rectangle' ? rectangleSeats : undefined,
        growthSides: tableType === 'rectangle' ? growthSides : undefined,
      },
      orderingDirection: direction,
      orderingPattern: orderingPattern,
      startPosition,
      seatModePattern,
      minSeats,
      maxSeats,
    };
  }, [
    name, description, sessionTypes, tableType, roundSeats, rectangleSeats,
    growthSides, direction, orderingPattern, startPosition, seatModes,
    minSeats, maxSeats,
  ]);

  // Validate and save
  const handleSave = () => {
    const template = buildTemplate();
    const validationErrors = validateTemplate(template);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSave(template);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {isEditMode ? 'Edit Template' : 'Create New Template'}
          </Typography>
        </Stack>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label="Basic Info" value="basic" />
        <Tab label="Table Config" value="config" />
        <Tab label="Seat Ordering" value="ordering" />
        <Tab label="Seat Modes" value="modes" />
        <Tab label="Scaling" value="scaling" />
      </Tabs>

      <DialogContent sx={{ minHeight: 500 }}>
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrors([])}>
            {errors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </Alert>
        )}

        {/* BASIC INFO TAB */}
        {activeTab === 'basic' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Template Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Executive Round Table"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Describe the use case for this template..."
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Recommended for Session Types:
              </Typography>
              <FormGroup row>
                {ALL_SESSION_TYPES.map((type) => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        checked={sessionTypes.includes(type)}
                        onChange={() => handleSessionTypeToggle(type)}
                      />
                    }
                    label={
                      <Chip
                        label={type}
                        size="small"
                        sx={{
                          bgcolor: sessionTypes.includes(type)
                            ? SESSION_TYPE_COLORS[type]
                            : 'grey.300',
                          color: sessionTypes.includes(type) ? 'white' : 'text.primary',
                        }}
                      />
                    }
                  />
                ))}
              </FormGroup>
            </Box>
          </Stack>
        )}

        {/* TABLE CONFIG TAB */}
        {activeTab === 'config' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Table Type</InputLabel>
              <Select
                value={tableType}
                label="Table Type"
                onChange={(e) => setTableType(e.target.value as 'round' | 'rectangle')}
              >
                <MenuItem value="round">Round Table</MenuItem>
                <MenuItem value="rectangle">Rectangle Table</MenuItem>
              </Select>
            </FormControl>

            {tableType === 'round' ? (
              <Box>
                <Typography gutterBottom>Number of Seats: {roundSeats}</Typography>
                <Slider
                  value={roundSeats}
                  onChange={(_, val) => setRoundSeats(val as number)}
                  min={4}
                  max={20}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>
            ) : (
              <>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Top Seats"
                    type="number"
                    value={rectangleSeats.top}
                    onChange={(e) =>
                      setRectangleSeats((prev) => ({
                        ...prev,
                        top: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                  <TextField
                    label="Bottom Seats"
                    type="number"
                    value={rectangleSeats.bottom}
                    onChange={(e) =>
                      setRectangleSeats((prev) => ({
                        ...prev,
                        bottom: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    inputProps={{ min: 0, max: 10 }}
                  />
                  <TextField
                    label="Left Seats"
                    type="number"
                    value={rectangleSeats.left}
                    onChange={(e) =>
                      setRectangleSeats((prev) => ({
                        ...prev,
                        left: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    inputProps={{ min: 0, max: 5 }}
                  />
                  <TextField
                    label="Right Seats"
                    type="number"
                    value={rectangleSeats.right}
                    onChange={(e) =>
                      setRectangleSeats((prev) => ({
                        ...prev,
                        right: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    inputProps={{ min: 0, max: 5 }}
                  />
                </Stack>

                <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Growth Sides (which sides expand when scaling):
                  </Typography>
                  <FormGroup row>
                    {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                      <FormControlLabel
                        key={side}
                        control={
                          <Checkbox
                            checked={growthSides[side]}
                            onChange={() => handleGrowthSideToggle(side)}
                          />
                        }
                        label={side.charAt(0).toUpperCase() + side.slice(1)}
                      />
                    ))}
                  </FormGroup>
                  <Typography variant="caption" color="text.secondary">
                    When the template scales to more/fewer seats, only selected sides will change.
                  </Typography>
                </Paper>
              </>
            )}

            <Typography variant="body2" color="text.secondary">
              Total Seats: <strong>{totalSeats}</strong>
            </Typography>
          </Stack>
        )}

        {/* ORDERING TAB */}
        {activeTab === 'ordering' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <SeatOrderingControls
              direction={direction}
              orderingPattern={orderingPattern}
              startPosition={startPosition}
              totalSeats={totalSeats}
              onDirectionChange={setDirection}
              onPatternChange={setOrderingPattern}
              onReset={handleResetOrdering}
              tableType={tableType}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#fafafa',
                minHeight: 300,
                p: 2,
                borderRadius: 1,
              }}
            >
              <TablePreview
                type={tableType}
                roundSeats={roundSeats}
                rectangleSeats={rectangleSeats}
                seatOrdering={seatOrdering}
                seatModes={seatModes}
                startPosition={startPosition}
                onSeatClick={handleSeatClick}
                interactionMode="ordering"
                size="medium"
              />
            </Box>

            <PatternPreview seatOrdering={seatOrdering} />
          </Stack>
        )}

        {/* MODES TAB */}
        {activeTab === 'modes' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <SeatModeControls
              onSetAllModes={handleSetAllModes}
              onReset={() => setSeatModes(Array(totalSeats).fill('default'))}
              modeCounts={modeCounts}
            />

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#fafafa',
                minHeight: 300,
                p: 2,
                borderRadius: 1,
              }}
            >
              <TablePreview
                type={tableType}
                roundSeats={roundSeats}
                rectangleSeats={rectangleSeats}
                seatOrdering={seatOrdering}
                seatModes={seatModes}
                startPosition={startPosition}
                onSeatClick={handleSeatClick}
                interactionMode="modes"
                size="medium"
              />
            </Box>

            <SeatModeLegend modeCounts={modeCounts} />

            <SeatModeMenu
              anchorEl={modeMenuAnchor}
              onClose={handleModeMenuClose}
              onSelect={handleModeSelect}
              currentMode={selectedSeatIndex !== null ? seatModes[selectedSeatIndex] : 'default'}
            />
          </Stack>
        )}

        {/* SCALING TAB */}
        {activeTab === 'scaling' && (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0' }}>
              <Typography variant="subtitle2" gutterBottom>
                Scaling Limits
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                When users create tables from this template, they can adjust the seat count within these limits.
                The ordering pattern and seat mode pattern will scale automatically.
              </Typography>
            </Paper>

            <Stack direction="row" spacing={4}>
              <Box sx={{ flex: 1 }}>
                <Typography gutterBottom>Minimum Seats: {minSeats}</Typography>
                <Slider
                  value={minSeats}
                  onChange={(_, val) => setMinSeats(Math.min(val as number, maxSeats))}
                  min={2}
                  max={30}
                  valueLabelDisplay="auto"
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography gutterBottom>Maximum Seats: {maxSeats}</Typography>
                <Slider
                  value={maxSeats}
                  onChange={(_, val) => setMaxSeats(Math.max(val as number, minSeats))}
                  min={2}
                  max={40}
                  valueLabelDisplay="auto"
                />
              </Box>
            </Stack>

            <Divider />

            <Typography variant="subtitle2">Preview at Different Sizes:</Typography>
            <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
              {[minSeats, Math.floor((minSeats + maxSeats) / 2), maxSeats].map((count) => {
                // Scale the configuration
                let scaledOrdering: number[];
                let scaledModes: SeatMode[];
                let displaySeats = rectangleSeats;

                if (tableType === 'round') {
                  scaledOrdering = generateOrdering(count, direction, orderingPattern, startPosition % count);
                  scaledModes = generateSeatModes({
                    type: 'specific',
                    specificModes: seatModes.reduce((acc, mode, idx) => {
                      if (mode !== 'default') acc[idx % count] = mode;
                      return acc;
                    }, {} as Record<number, SeatMode>),
                    defaultMode: 'default',
                  }, count);
                } else {
                  displaySeats = scaleRectangleSeats(rectangleSeats, growthSides, count);
                  const scaledTotal = displaySeats.top + displaySeats.bottom + displaySeats.left + displaySeats.right;
                  scaledOrdering = generateOrdering(scaledTotal, direction, orderingPattern, startPosition % scaledTotal, displaySeats);
                  scaledModes = generateSeatModes({
                    type: 'specific',
                    specificModes: seatModes.reduce((acc, mode, idx) => {
                      if (mode !== 'default') acc[idx % scaledTotal] = mode;
                      return acc;
                    }, {} as Record<number, SeatMode>),
                    defaultMode: 'default',
                  }, scaledTotal);
                }

                return (
                  <Box key={count} sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {count} seats
                    </Typography>
                    <TablePreview
                      type={tableType}
                      roundSeats={tableType === 'round' ? count : undefined}
                      rectangleSeats={tableType === 'rectangle' ? displaySeats : undefined}
                      growthSides={tableType === 'rectangle' ? growthSides : undefined}
                      seatOrdering={scaledOrdering}
                      seatModes={scaledModes}
                      size="small"
                      showLabels={false}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} startIcon={<Close />}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<Save />}
          disabled={!name.trim() || sessionTypes.length === 0}
        >
          {isEditMode ? 'Save Changes' : 'Create Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}