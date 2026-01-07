// components/molecules/CreateEditTemplateModalV2.tsx
// V2 Template Modal - Uses global insertion order for scaling
// - Uses reusable SeatOrderingPanel and SeatModePanel
// - Uses reusable TablePreview component
// - New ScalingInsertionOrderEditor for defining scaling behavior

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
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
  FormControlLabel,
  Switch,
  Alert,
  FormGroup,
  Checkbox,
} from '@mui/material';
import {
  Circle,
  Rectangle,
  Check,
} from '@mui/icons-material';

// V2 Types
import {
  TableTemplateV2,
  CircleTableConfigV2,
  RectangleTableConfigV2,
  RectangleSideConfigV2,
  CreateTemplateInputV2,
  InsertionPointV2,
  SeatMode,
  EventType,
  SideKeyV2,
  SeatOrderingPatternV2,
  SeatModePatternV2,
  isCircleConfigV2,
  isRectangleConfigV2,
  SESSION_TYPE_COLORS_V2,
} from '@/types/TemplateV2';

// Reusable components
import TablePreview from '../atoms/TablePreview';
import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';
import SeatOrderingPanel from './SeatOrderingPanel';
import SeatModePanel from './SeatModePanel';
import ScalingInsertionOrderEditor from './ScalingInsertionOrderEditor';

// ============================================================================
// TYPES
// ============================================================================

interface CreateEditTemplateModalV2Props {
  open: boolean;
  onClose: () => void;
  onSave: (template: CreateTemplateInputV2) => void;
  editTemplate?: TableTemplateV2 | null;
  initialSessionType?: EventType | null;
}

type TabValue = 'basic' | 'shape' | 'scaling' | 'ordering' | 'modes' | 'preview';

// ============================================================================
// SIMPLE SIDE CONFIG PANEL (Shape tab)
// ============================================================================

interface SimpleSideConfigProps {
  side: SideKeyV2;
  config: RectangleSideConfigV2;
  onChange: (config: RectangleSideConfigV2) => void;
}

function SimpleSideConfig({ side, config, onChange }: SimpleSideConfigProps) {
  const label = side.charAt(0).toUpperCase() + side.slice(1);
  
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        bgcolor: config.enabled ? '#e8f5e9' : '#fafafa',
        border: config.enabled ? '1px solid #81c784' : '1px solid #e0e0e0',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" fontWeight="bold">{label}</Typography>
          <Switch
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
            size="small"
          />
        </Stack>

        {config.enabled && (
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="Seats"
              type="number"
              value={config.seatCount}
              onChange={(e) => onChange({ 
                ...config, 
                seatCount: Math.max(0, parseInt(e.target.value) || 0) 
              })}
              size="small"
              sx={{ width: 80 }}
              inputProps={{ min: 0, max: 20 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.scalable}
                  onChange={(e) => onChange({ ...config, scalable: e.target.checked })}
                  size="small"
                  disabled={config.seatCount === 0}
                />
              }
              label={<Typography variant="body2">Scalable</Typography>}
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CreateEditTemplateModalV2({
  open,
  onClose,
  onSave,
  editTemplate = null,
  initialSessionType = null,
}: CreateEditTemplateModalV2Props) {
  const isEditing = !!editTemplate;
  const [currentTab, setCurrentTab] = useState<TabValue>('basic');

  // ============================================================================
  // BASIC INFO STATE
  // ============================================================================
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSessionTypes, setSelectedSessionTypes] = useState<EventType[]>([]);

  // ============================================================================
  // SHAPE STATE
  // ============================================================================
  const [tableType, setTableType] = useState<'circle' | 'rectangle'>('circle');
  const [circleSeatCount, setCircleSeatCount] = useState(8);
  const [rectangleSides, setRectangleSides] = useState<Record<SideKeyV2, RectangleSideConfigV2>>({
    top: { seatCount: 3, scalable: true, enabled: true, allocationPriority: 0 },
    right: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 2 },
    bottom: { seatCount: 3, scalable: true, enabled: true, allocationPriority: 1 },
    left: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 3 },
  });

  // Global insertion order for scaling (sequence of edge positions)
  const [insertionOrder, setInsertionOrder] = useState<InsertionPointV2[]>([]);

  // ============================================================================
  // ORDERING & MODES (managed by reusable panels)
  // ============================================================================
  const [seatOrdering, setSeatOrdering] = useState<number[]>([]);
  const [seatModes, setSeatModes] = useState<SeatMode[]>([]);
  const [resetKey, setResetKey] = useState(0);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const baseSeatCount = useMemo(() => {
    if (tableType === 'circle') return circleSeatCount;
    return (
      (rectangleSides.top.enabled ? rectangleSides.top.seatCount : 0) +
      (rectangleSides.right.enabled ? rectangleSides.right.seatCount : 0) +
      (rectangleSides.bottom.enabled ? rectangleSides.bottom.seatCount : 0) +
      (rectangleSides.left.enabled ? rectangleSides.left.seatCount : 0)
    );
  }, [tableType, circleSeatCount, rectangleSides]);

  const rectangleSeatsForPreview = useMemo(() => ({
    top: rectangleSides.top.enabled ? rectangleSides.top.seatCount : 0,
    right: rectangleSides.right.enabled ? rectangleSides.right.seatCount : 0,
    bottom: rectangleSides.bottom.enabled ? rectangleSides.bottom.seatCount : 0,
    left: rectangleSides.left.enabled ? rectangleSides.left.seatCount : 0,
  }), [rectangleSides]);

  const scalableSides = useMemo(() => {
    return (['top', 'right', 'bottom', 'left'] as SideKeyV2[]).filter(
      side => rectangleSides[side].enabled && 
              rectangleSides[side].scalable && 
              rectangleSides[side].seatCount > 0
    );
  }, [rectangleSides]);

  // Default ordering/modes for preview
  const defaultOrdering = useMemo(() => 
    Array(baseSeatCount).fill(0).map((_, i) => i + 1), 
    [baseSeatCount]
  );
  
  const defaultModes = useMemo(() => 
    Array(baseSeatCount).fill('default' as SeatMode), 
    [baseSeatCount]
  );

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!name.trim()) errors.push('Template name is required');
    if (baseSeatCount < 2) errors.push('Table must have at least 2 seats');
    if (selectedSessionTypes.length === 0) errors.push('Select at least one session type');
    return errors;
  }, [name, baseSeatCount, selectedSessionTypes]);

  const isValid = validationErrors.length === 0;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load edit template
  useEffect(() => {
    if (!open) return;
    
    if (editTemplate) {
      setName(editTemplate.name);
      setDescription(editTemplate.description);
      setSelectedSessionTypes([...editTemplate.sessionTypes]);

      const config = editTemplate.config;
      setTableType(config.type);

      if (isCircleConfigV2(config)) {
        setCircleSeatCount(config.baseSeatCount);
      } else if (isRectangleConfigV2(config)) {
        setRectangleSides(config.sides);
        // Load insertion order if it exists
        if (config.scalingConfig.insertionOrder) {
          setInsertionOrder([...config.scalingConfig.insertionOrder]);
        }
      }
    } else {
      // Reset to defaults
      setName('');
      setDescription('');
      setSelectedSessionTypes(initialSessionType ? [initialSessionType] : ['Executive meeting']);
      setTableType('circle');
      setCircleSeatCount(8);
      setRectangleSides({
        top: { seatCount: 3, scalable: true, enabled: true, allocationPriority: 0 },
        right: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 2 },
        bottom: { seatCount: 3, scalable: true, enabled: true, allocationPriority: 1 },
        left: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 3 },
      });
      setInsertionOrder([]);
      setSeatOrdering([]);
      setSeatModes([]);
    }
    setCurrentTab('basic');
    setResetKey(prev => prev + 1);
  }, [editTemplate, initialSessionType, open]);

  // Clear insertion order when scalable sides change
  useEffect(() => {
    // Filter out any insertion points for sides that are no longer scalable
    const validOrder = insertionOrder.filter(point => scalableSides.includes(point.side));
    if (validOrder.length !== insertionOrder.length) {
      setInsertionOrder(validOrder);
    }
  }, [scalableSides]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSessionTypeToggle = (type: EventType) => {
    setSelectedSessionTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSideChange = (side: SideKeyV2, config: RectangleSideConfigV2) => {
    setRectangleSides(prev => ({ ...prev, [side]: config }));
  };

  const handleInsertionOrderChange = useCallback((order: InsertionPointV2[]) => {
    setInsertionOrder(order);
  }, []);

  const handleOrderingChange = useCallback((ordering: number[]) => {
    console.log('CALLING CETEMPLATEMODAL')
    setSeatOrdering(prev => {
      if (
        prev.length === ordering.length &&
        prev.every((v, i) => v === ordering[i])
      ) {
        console.log('No change in ordering detected, skipping state update.');
        return prev; // 🚫 no state change → no re-render → loop broken
      }
      console.log('Ordering changed:', ordering);
      return ordering;
    });
  }, []);

  const handleModesChange = useCallback((modes: SeatMode[]) => {
    setSeatModes(modes);
  }, []);

  const handleSave = () => {
    // Build ordering pattern - use manual if user customized it
    const hasCustomOrdering = seatOrdering.length === baseSeatCount;
    const orderingPatternConfig: SeatOrderingPatternV2 = hasCustomOrdering
      ? { type: 'manual', direction: 'clockwise', startPosition: 0, manualOrdering: seatOrdering }
      : { type: 'sequential', direction: 'clockwise', startPosition: 0 };
    
    // Build mode pattern
    const hasCustomModes = seatModes.length === baseSeatCount;
    const modePatternConfig: SeatModePatternV2 = hasCustomModes
      ? { type: 'manual', defaultMode: 'default', manualModes: seatModes }
      : { type: 'uniform', defaultMode: 'default' };
    
    const config: CircleTableConfigV2 | RectangleTableConfigV2 = tableType === 'circle'
      ? {
          type: 'circle',
          baseSeatCount: circleSeatCount,
          orderingPattern: orderingPatternConfig,
          modePattern: modePatternConfig,
        }
      : {
          type: 'rectangle',
          sides: rectangleSides,
          scalingConfig: { 
            allocationStrategy: 'round-robin', 
            alternateOppositeSides: true,
            insertionOrder: insertionOrder.length > 0 ? insertionOrder : undefined,
          },
          orderingPattern: orderingPatternConfig,
          modePattern: modePatternConfig,
        };

    const input: CreateTemplateInputV2 = {
      name,
      description,
      sessionTypes: selectedSessionTypes,
      isUserCreated: true,
      color: SESSION_TYPE_COLORS_V2[selectedSessionTypes[0]] || '#1976d2',
      config,
    };

    onSave(input);
    onClose();
  };

  // Available tabs based on table type
  const availableTabs: TabValue[] = tableType === 'circle'
    ? ['basic', 'shape', 'ordering', 'modes', 'preview']
    : ['basic', 'shape', 'scaling', 'ordering', 'modes', 'preview'];

  const handleNextTab = () => {
    const idx = availableTabs.indexOf(currentTab);
    if (idx < availableTabs.length - 1) {
      setCurrentTab(availableTabs[idx + 1]);
    }
  };

  const handlePrevTab = () => {
    const idx = availableTabs.indexOf(currentTab);
    if (idx > 0) {
      setCurrentTab(availableTabs[idx - 1]);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{ sx: { minHeight: '80vh' } }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {isEditing ? 'Edit Template' : 'Create New Template'}
          </Typography>
          <Chip 
            label={`${baseSeatCount} seats`} 
            size="small" 
            color="primary" 
            variant="outlined" 
          />
        </Stack>
      </DialogTitle>

      <Tabs
        value={currentTab}
        onChange={(_, v) => setCurrentTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
      >
        <Tab label="Basic Info" value="basic" />
        <Tab label="Shape" value="shape" />
        {tableType === 'rectangle' && <Tab label="Scaling" value="scaling" />}
        <Tab label="Ordering" value="ordering" />
        <Tab label="Modes" value="modes" />
        <Tab label="Preview" value="preview" />
      </Tabs>

      <DialogContent sx={{ pt: 3 }}>
        {/* ================================================================ */}
        {/* BASIC TAB */}
        {/* ================================================================ */}
        {currentTab === 'basic' && (
          <Stack spacing={3}>
            <TextField
              label="Template Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              error={!name.trim()}
              helperText={!name.trim() ? 'Required' : ''}
              autoFocus
            />
            
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Describe the purpose of this template..."
            />
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Session Types *
              </Typography>
              <FormGroup row>
                {(['Executive meeting', 'Bilateral Meeting', 'Meal', 'Phototaking'] as EventType[]).map((type) => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        checked={selectedSessionTypes.includes(type)}
                        onChange={() => handleSessionTypeToggle(type)}
                      />
                    }
                    label={
                      <Chip
                        label={type}
                        size="small"
                        sx={{
                          bgcolor: SESSION_TYPE_COLORS_V2[type],
                          color: 'white',
                          opacity: selectedSessionTypes.includes(type) ? 1 : 0.4,
                        }}
                      />
                    }
                  />
                ))}
              </FormGroup>
              {selectedSessionTypes.length === 0 && (
                <Typography variant="caption" color="error">
                  Select at least one session type
                </Typography>
              )}
            </Box>
          </Stack>
        )}

        {/* ================================================================ */}
        {/* SHAPE TAB */}
        {/* ================================================================ */}
        {currentTab === 'shape' && (
          <Stack spacing={3}>
            {/* Shape selector */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Table Shape</Typography>
              <ToggleButtonGroup
                value={tableType}
                exclusive
                onChange={(_, v) => v && setTableType(v)}
                size="large"
              >
                <ToggleButton value="circle" sx={{ px: 4, py: 2 }}>
                  <Stack alignItems="center" spacing={0.5}>
                    <Circle sx={{ fontSize: 32 }} />
                    <Typography variant="body2">Round</Typography>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="rectangle" sx={{ px: 4, py: 2 }}>
                  <Stack alignItems="center" spacing={0.5}>
                    <Rectangle sx={{ fontSize: 32 }} />
                    <Typography variant="body2">Rectangle</Typography>
                  </Stack>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Divider />

            {/* CIRCLE CONFIG */}
            {tableType === 'circle' && (
              <Stack spacing={3}>
                <TextField
                  label="Number of Seats"
                  type="number"
                  value={circleSeatCount}
                  onChange={(e) => setCircleSeatCount(Math.max(2, parseInt(e.target.value) || 2))}
                  inputProps={{ min: 2, max: 30 }}
                  sx={{ width: 150 }}
                />
                
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Preview
                  </Typography>
                  <ScrollablePreviewContainer maxHeight={300}>
                    <TablePreview
                      type="round"
                      roundSeats={circleSeatCount}
                      seatOrdering={defaultOrdering}
                      seatModes={defaultModes}
                      size="medium"
                      showLabels
                    />
                  </ScrollablePreviewContainer>
                </Paper>
              </Stack>
            )}

            {/* RECTANGLE CONFIG */}
            {tableType === 'rectangle' && (
              <Stack spacing={3}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <SimpleSideConfig
                    side="top"
                    config={rectangleSides.top}
                    onChange={(c) => handleSideChange('top', c)}
                  />
                  <SimpleSideConfig
                    side="bottom"
                    config={rectangleSides.bottom}
                    onChange={(c) => handleSideChange('bottom', c)}
                  />
                  <SimpleSideConfig
                    side="left"
                    config={rectangleSides.left}
                    onChange={(c) => handleSideChange('left', c)}
                  />
                  <SimpleSideConfig
                    side="right"
                    config={rectangleSides.right}
                    onChange={(c) => handleSideChange('right', c)}
                  />
                </Box>

                <Alert severity="info" sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    Total: {baseSeatCount} seats • 
                    Scalable sides: {scalableSides.length > 0 ? scalableSides.join(', ') : 'None'}
                  </Typography>
                </Alert>

                <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Preview</Typography>
                  <ScrollablePreviewContainer maxHeight={300}>
                    <TablePreview
                      type="rectangle"
                      rectangleSeats={rectangleSeatsForPreview}
                      seatOrdering={defaultOrdering}
                      seatModes={defaultModes}
                      size="medium"
                      showLabels
                    />
                  </ScrollablePreviewContainer>
                </Paper>
              </Stack>
            )}
          </Stack>
        )}

        {/* ================================================================ */}
        {/* SCALING TAB (Rectangle only) - Uses new editor */}
        {/* ================================================================ */}
        {currentTab === 'scaling' && tableType === 'rectangle' && (
          <Stack spacing={3}>
            {scalableSides.length === 0 ? (
              <Alert severity="warning">
                No sides are marked as scalable. Go to the Shape tab to enable scaling on at least one side.
              </Alert>
            ) : (
              <ScalingInsertionOrderEditor
                scalableSides={scalableSides}
                insertionOrder={insertionOrder}
                onChange={handleInsertionOrderChange}
              />
            )}

            {/* Preview with growth indicators */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Table Preview (scalable sides highlighted)
              </Typography>
              <ScrollablePreviewContainer maxHeight={280}>
                <TablePreview
                  type="rectangle"
                  rectangleSeats={rectangleSeatsForPreview}
                  seatOrdering={defaultOrdering}
                  seatModes={defaultModes}
                  growthSides={{
                    top: scalableSides.includes('top'),
                    bottom: scalableSides.includes('bottom'),
                    left: scalableSides.includes('left'),
                    right: scalableSides.includes('right'),
                  }}
                  size="medium"
                  showLabels
                />
              </ScrollablePreviewContainer>
            </Paper>
          </Stack>
        )}

        {/* ================================================================ */}
        {/* ORDERING TAB - Uses SeatOrderingPanel */}
        {/* ================================================================ */}
        {currentTab === 'ordering' && (
          <SeatOrderingPanel
            tableType={tableType === 'circle' ? 'round' : 'rectangle'}
            roundSeats={circleSeatCount}
            rectangleSeats={rectangleSeatsForPreview}
            seatModes={seatModes.length === baseSeatCount ? seatModes : defaultModes}
            onOrderingChange={handleOrderingChange}
            previewSize="large"
            maxPreviewHeight={380}
            showModeToggle={true}
            resetKey={resetKey}
          />
        )}

        {/* ================================================================ */}
        {/* MODES TAB - Uses SeatModePanel */}
        {/* ================================================================ */}
        {currentTab === 'modes' && (
          <SeatModePanel
            tableType={tableType === 'circle' ? 'round' : 'rectangle'}
            roundSeats={circleSeatCount}
            rectangleSeats={rectangleSeatsForPreview}
            seatOrdering={seatOrdering.length === baseSeatCount ? seatOrdering : defaultOrdering}
            seatModes={seatModes.length === baseSeatCount ? seatModes : defaultModes}
            onModesChange={handleModesChange}
            previewSize="large"
            maxPreviewHeight={380}
            showResetButton={true}
            resetKey={resetKey}
          />
        )}

        {/* ================================================================ */}
        {/* PREVIEW TAB */}
        {/* ================================================================ */}
        {currentTab === 'preview' && (
          <Stack spacing={3}>
            {isValid ? (
              <Alert severity="success" icon={<Check />}>
                Template is ready to save!
              </Alert>
            ) : (
              <Alert severity="error">
                {validationErrors.join('. ')}
              </Alert>
            )}

            {/* Summary */}
            <Paper elevation={0} sx={{ p: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                {name || 'Unnamed Template'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {description || 'No description'}
              </Typography>
              
              <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
                {selectedSessionTypes.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    size="small"
                    sx={{ bgcolor: SESSION_TYPE_COLORS_V2[type], color: 'white' }}
                  />
                ))}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>Shape:</strong> {tableType === 'circle' ? 'Round' : 'Rectangle'}
                </Typography>
                <Typography variant="body2">
                  <strong>Seats:</strong> {baseSeatCount}
                </Typography>
                {tableType === 'rectangle' && scalableSides.length > 0 && (
                  <>
                    <Typography variant="body2">
                      <strong>Scalable:</strong> {scalableSides.join(', ')}
                    </Typography>
                    {insertionOrder.length > 0 && (
                      <Typography variant="body2">
                        <strong>Insertion order:</strong>{' '}
                        {insertionOrder.map((p, i) => {
                          const sideLabel = p.side.charAt(0).toUpperCase() + p.side.slice(1);
                          const edgeLabel = (p.side === 'top' || p.side === 'bottom') 
                            ? (p.edge === 'start' ? 'Left' : 'Right')
                            : (p.edge === 'start' ? 'Top' : 'Bottom');
                          return `${sideLabel}-${edgeLabel}`;
                        }).join(' → ')} → (repeats)
                      </Typography>
                    )}
                  </>
                )}
              </Stack>
            </Paper>

            {/* Final Preview */}
            <Paper elevation={0} sx={{ p: 3, bgcolor: '#e3f2fd', borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Table Preview
              </Typography>
              <ScrollablePreviewContainer maxHeight={400}>
                <TablePreview
                  type={tableType === 'circle' ? 'round' : 'rectangle'}
                  roundSeats={circleSeatCount}
                  rectangleSeats={rectangleSeatsForPreview}
                  seatOrdering={seatOrdering.length === baseSeatCount ? seatOrdering : defaultOrdering}
                  seatModes={seatModes.length === baseSeatCount ? seatModes : defaultModes}
                  size="large"
                  showLabels
                />
              </ScrollablePreviewContainer>
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button onClick={handlePrevTab} disabled={currentTab === 'basic'}>
          Back
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          {currentTab !== 'preview' ? (
            <Button
              variant="contained"
              onClick={handleNextTab}
              disabled={currentTab === 'basic' && !name.trim()}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!isValid}
              color="success"
            >
              {isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}