// components/molecules/TemplateCustomizationModal.tsx
// Modal for customizing a template before creating tables
// - Scale the template (add/remove seats)
// - Edit seat ordering
// - Edit seat modes
// - Select quantity of tables to create
// - Live preview of changes
// FIXED: Properly passes currentOrdering to preserve user's selections across tab switches

'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Box,
  Paper,
  Chip,
  Divider,
  Slider,
  TextField,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Remove,
  Check,
  Refresh,
  Info,
} from '@mui/icons-material';

// V2 Types
import {
  TableTemplateV2,
  SeatMode,
  SideKeyV2,
  isCircleConfigV2,
  isRectangleConfigV2,
  getTotalSeatCountV2,
  SESSION_TYPE_COLORS_V2,
  ScaledResultV2,
  isCircleResultV2,
  DirectionV2,
  OrderingPatternTypeV2,
} from '@/types/TemplateV2';

// V2 Scaler
import { scaleTemplateV2, getScaleRangeV2 } from '@/utils/templateScalerV2';

// Reusable components
import TablePreview from '../atoms/TablePreview';
import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';
import SeatOrderingPanel from './SeatOrderingPanel';
import SeatModePanel from './SeatModePanel';

// ============================================================================
// TYPES
// ============================================================================

export interface CustomizedTableConfig {
  seatCount: number;
  seatOrdering: number[];
  seatModes: SeatMode[];
  rectangleSeats?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  quantity: number;
  templateId: string;
  templateName: string;
}

interface TemplateCustomizationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: CustomizedTableConfig) => void;
  template: TableTemplateV2 | null;
}

type TabValue = 'preview' | 'ordering' | 'modes';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TemplateCustomizationModal({
  open,
  onClose,
  onConfirm,
  template,
}: TemplateCustomizationModalProps) {
  const [currentTab, setCurrentTab] = useState<TabValue>('preview');
  const [quantity, setQuantity] = useState(1);
  const [targetSeatCount, setTargetSeatCount] = useState(0);
  
  // Customized ordering and modes (user can edit these)
  const [customOrdering, setCustomOrdering] = useState<number[]>([]);
  const [customModes, setCustomModes] = useState<SeatMode[]>([]);
  const [hasCustomizedOrdering, setHasCustomizedOrdering] = useState(false);
  const [hasCustomizedModes, setHasCustomizedModes] = useState(false);
  
  // Reset key for child components
  const [resetKey, setResetKey] = useState(0);
  
  // Ref to track the template ordering for comparison
  const templateOrderingRef = useRef<number[]>([]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const baseSeatCount = useMemo(() => {
    if (!template) return 0;
    return getTotalSeatCountV2(template.config);
  }, [template]);

  const scaleRange = useMemo(() => {
    if (!template) return { min: 2, max: 30 };
    return getScaleRangeV2(template);
  }, [template]);

  const tableType = useMemo(() => {
    if (!template) return 'round';
    return isCircleConfigV2(template.config) ? 'round' : 'rectangle';
  }, [template]);

  // Extract ordering pattern from template
  const templateOrderingPattern = useMemo(() => {
    if (!template) {
      return {
        direction: 'counter-clockwise' as DirectionV2,
        type: 'sequential' as OrderingPatternTypeV2,
        startPosition: 0,
      };
    }
    
    const { orderingPattern } = template.config;
    return {
      direction: orderingPattern.direction,
      type: orderingPattern.type,
      startPosition: orderingPattern.startPosition,
    };
  }, [template]);

  // Scale the template
  const scaledResult = useMemo((): ScaledResultV2 | null => {
    if (!template || targetSeatCount === 0) return null;
    
    try {
      return scaleTemplateV2(template, {
        targetSeatCount,
        propagateModePattern: true,
      });
    } catch (e) {
      console.error('Scaling error:', e);
      return null;
    }
  }, [template, targetSeatCount]);

  // Update the template ordering ref when scaled result changes
  useEffect(() => {
    if (scaledResult) {
      templateOrderingRef.current = scaledResult.seatOrdering;
    }
  }, [scaledResult]);

  // Current ordering to display (custom if edited, otherwise from scaled result)
  const displayOrdering = useMemo(() => {
    if (hasCustomizedOrdering && customOrdering.length === targetSeatCount) {
      return customOrdering;
    }
    return scaledResult?.seatOrdering || [];
  }, [hasCustomizedOrdering, customOrdering, scaledResult, targetSeatCount]);

  // Current modes to display (custom if edited, otherwise from scaled result)
  const displayModes = useMemo(() => {
    if (hasCustomizedModes && customModes.length === targetSeatCount) {
      return customModes;
    }
    return scaledResult?.seatModes || [];
  }, [hasCustomizedModes, customModes, scaledResult, targetSeatCount]);

  // Rectangle seats for preview
  const rectangleSeats = useMemo(() => {
    if (scaledResult && !isCircleResultV2(scaledResult)) {
      return scaledResult.sideSeats;
    }
    if (!template || !isRectangleConfigV2(template.config)) return undefined;
    
    const sides = template.config.sides;
    return {
      top: sides.top.enabled ? sides.top.seatCount : 0,
      right: sides.right.enabled ? sides.right.seatCount : 0,
      bottom: sides.bottom.enabled ? sides.bottom.seatCount : 0,
      left: sides.left.enabled ? sides.left.seatCount : 0,
    };
  }, [scaledResult, template]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize when template changes or modal opens
  useEffect(() => {
    if (!open || !template) return;
    
    const base = getTotalSeatCountV2(template.config);
    setTargetSeatCount(base);
    setQuantity(1);
    setHasCustomizedOrdering(false);
    setHasCustomizedModes(false);
    setCustomOrdering([]);
    setCustomModes([]);
    setCurrentTab('preview');
    setResetKey(prev => prev + 1);
  }, [open, template]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSeatCountChange = (newCount: number) => {
    const clampedCount = Math.max(scaleRange.min, Math.min(scaleRange.max, newCount));
    if (clampedCount !== targetSeatCount) {
      setTargetSeatCount(clampedCount);
      // Reset customizations when seat count changes
      setHasCustomizedOrdering(false);
      setHasCustomizedModes(false);
      setCustomOrdering([]);
      setCustomModes([]);
      // Reset key to reinitialize child components
      setResetKey(prev => prev + 1);
    }
  };

  // Callback for ordering changes from SeatOrderingPanel
  // Uses ref to compare with template ordering to avoid dependency issues
  const handleOrderingChange = useCallback((ordering: number[]) => {
    const templateOrdering = templateOrderingRef.current;
    
    // Check if this ordering differs from the template default
    if (templateOrdering.length === 0) {
      // Template not loaded yet, just store the ordering
      setCustomOrdering(ordering);
      return;
    }
    
    if (ordering.length !== templateOrdering.length) {
      setCustomOrdering(ordering);
      setHasCustomizedOrdering(true);
      return;
    }
    
    const isDifferent = ordering.some((val, idx) => val !== templateOrdering[idx]);
    setCustomOrdering(ordering);
    setHasCustomizedOrdering(isDifferent);
  }, []);

  // Callback for modes changes from SeatModePanel
  const handleModesChange = useCallback((modes: SeatMode[]) => {
    setCustomModes(modes);
    // We'll check if customized in an effect to avoid dependency issues
  }, []);

  // Effect to determine if modes are actually customized
  useEffect(() => {
    if (customModes.length === 0 || !scaledResult) {
      return;
    }
    
    const templateModes = scaledResult.seatModes;
    
    if (customModes.length !== templateModes.length) {
      setHasCustomizedModes(true);
      return;
    }
    
    const isDifferent = customModes.some((val, idx) => val !== templateModes[idx]);
    setHasCustomizedModes(isDifferent);
  }, [customModes, scaledResult]);

  const handleResetOrdering = () => {
    setCustomOrdering([]);
    setHasCustomizedOrdering(false);
    setResetKey(prev => prev + 1);
  };

  const handleResetModes = () => {
    setCustomModes([]);
    setHasCustomizedModes(false);
    setResetKey(prev => prev + 1);
  };

  const handleConfirm = () => {
    if (!template || !scaledResult) return;
    
    const config: CustomizedTableConfig = {
      seatCount: targetSeatCount,
      seatOrdering: displayOrdering,
      seatModes: displayModes,
      rectangleSeats: isCircleResultV2(scaledResult) ? undefined : scaledResult.sideSeats,
      quantity,
      templateId: template.id,
      templateName: template.name,
    };
    
    onConfirm(config);
    onClose();
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderScalingControls = () => (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2">Seat Count</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton 
              size="small" 
              onClick={() => handleSeatCountChange(targetSeatCount - 1)}
              disabled={targetSeatCount <= scaleRange.min}
            >
              <Remove fontSize="small" />
            </IconButton>
            <TextField
              value={targetSeatCount}
              onChange={(e) => handleSeatCountChange(parseInt(e.target.value) || baseSeatCount)}
              type="number"
              size="small"
              sx={{ width: 70 }}
              inputProps={{ 
                min: scaleRange.min, 
                max: scaleRange.max,
                style: { textAlign: 'center' }
              }}
            />
            <IconButton 
              size="small" 
              onClick={() => handleSeatCountChange(targetSeatCount + 1)}
              disabled={targetSeatCount >= scaleRange.max}
            >
              <Add fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        
        <Slider
          value={targetSeatCount}
          onChange={(_, v) => handleSeatCountChange(v as number)}
          min={scaleRange.min}
          max={scaleRange.max}
          step={1}
          marks={[
            { value: scaleRange.min, label: String(scaleRange.min) },
            { value: baseSeatCount, label: `${baseSeatCount} (base)` },
            { value: scaleRange.max, label: String(scaleRange.max) },
          ]}
          valueLabelDisplay="auto"
        />
        
        {scaledResult && targetSeatCount !== baseSeatCount && (
          <Alert 
            severity={targetSeatCount > baseSeatCount ? 'success' : 'warning'} 
            sx={{ py: 0.5 }}
          >
            <Typography variant="caption">
              {targetSeatCount > baseSeatCount 
                ? `+${targetSeatCount - baseSeatCount} seats added from base template`
                : `${baseSeatCount - targetSeatCount} seats removed from base template`
              }
            </Typography>
          </Alert>
        )}
      </Stack>
    </Paper>
  );

  const renderQuantityControl = () => (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">Tables to Create</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton 
            size="small" 
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            <Remove fontSize="small" />
          </IconButton>
          <TextField
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            type="number"
            size="small"
            sx={{ width: 60 }}
            inputProps={{ min: 1, max: 20, style: { textAlign: 'center' } }}
          />
          <IconButton 
            size="small" 
            onClick={() => setQuantity(Math.min(20, quantity + 1))}
            disabled={quantity >= 20}
          >
            <Add fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!template) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth 
      PaperProps={{ sx: { minHeight: '85vh' } }}
    >
      <DialogTitle>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Customize Table</Typography>
            <Stack direction="row" spacing={1}>
              {template.sessionTypes.map(type => (
                <Chip
                  key={type}
                  label={type}
                  size="small"
                  sx={{ bgcolor: SESSION_TYPE_COLORS_V2[type], color: 'white' }}
                />
              ))}
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Template: {template.name}
          </Typography>
        </Stack>
      </DialogTitle>

      {/* Tabs */}
      <Tabs
        value={currentTab}
        onChange={(_, v) => setCurrentTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
      >
        <Tab 
          label="Preview & Scale" 
          value="preview" 
        />
        <Tab 
          label={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <span>Seat Order</span>
              {hasCustomizedOrdering && (
                <Chip label="Edited" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />
              )}
            </Stack>
          } 
          value="ordering" 
        />
        <Tab 
          label={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <span>Seat Modes</span>
              {hasCustomizedModes && (
                <Chip label="Edited" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />
              )}
            </Stack>
          } 
          value="modes" 
        />
      </Tabs>

      <DialogContent sx={{ pt: 3 }}>
        {/* ================================================================ */}
        {/* PREVIEW TAB */}
        {/* ================================================================ */}
        {currentTab === 'preview' && (
          <Stack spacing={3}>
            {/* Scaling controls */}
            {renderScalingControls()}
            
            {/* Table preview */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Table Preview
              </Typography>
              <ScrollablePreviewContainer maxHeight={350}>
                <TablePreview
                  type={tableType}
                  roundSeats={tableType === 'round' ? targetSeatCount : undefined}
                  rectangleSeats={rectangleSeats}
                  seatOrdering={displayOrdering}
                  seatModes={displayModes}
                  size="large"
                  showLabels
                />
              </ScrollablePreviewContainer>
            </Paper>

            {/* Info about customization */}
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                <strong>Customize your table:</strong>
              </Typography>
              <Typography variant="caption">
                Use the tabs above to edit seat ordering and seat modes. 
                Changes are preserved when you adjust the seat count.
              </Typography>
            </Alert>

            {/* Quantity control */}
            {renderQuantityControl()}
          </Stack>
        )}

        {/* ================================================================ */}
        {/* ORDERING TAB */}
        {/* ================================================================ */}
        {currentTab === 'ordering' && (
          <Stack spacing={2}>
            {hasCustomizedOrdering && (
              <Alert 
                severity="info" 
                action={
                  <Button size="small" onClick={handleResetOrdering} startIcon={<Refresh />}>
                    Reset
                  </Button>
                }
              >
                <Typography variant="caption">
                  Ordering has been customized. Click Reset to restore template defaults.
                </Typography>
              </Alert>
            )}
            
            <SeatOrderingPanel
              tableType={tableType}
              roundSeats={tableType === 'round' ? targetSeatCount : undefined}
              rectangleSeats={rectangleSeats}
              seatModes={displayModes}
              initialDirection={templateOrderingPattern.direction}
              initialPattern={templateOrderingPattern.type === 'manual' ? 'sequential' : templateOrderingPattern.type}
              initialStartPosition={templateOrderingPattern.startPosition}
              initialOrdering={scaledResult?.seatOrdering}
              currentOrdering={customOrdering.length === targetSeatCount ? customOrdering : undefined}
              onOrderingChange={handleOrderingChange}
              previewSize="large"
              maxPreviewHeight={400}
              showModeToggle={true}
              resetKey={resetKey}
            />
          </Stack>
        )}

        {/* ================================================================ */}
        {/* MODES TAB */}
        {/* ================================================================ */}
        {currentTab === 'modes' && (
          <Stack spacing={2}>
            {hasCustomizedModes && (
              <Alert 
                severity="info" 
                action={
                  <Button size="small" onClick={handleResetModes} startIcon={<Refresh />}>
                    Reset
                  </Button>
                }
              >
                <Typography variant="caption">
                  Modes have been customized. Click Reset to restore template defaults.
                </Typography>
              </Alert>
            )}
            
            <SeatModePanel
              tableType={tableType}
              roundSeats={tableType === 'round' ? targetSeatCount : undefined}
              rectangleSeats={rectangleSeats}
              seatOrdering={displayOrdering}
              seatModes={displayModes}
              onModesChange={handleModesChange}
              previewSize="large"
              maxPreviewHeight={400}
              showResetButton={false}
              resetKey={resetKey}
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f5f5f5' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%">
          <Typography variant="body2" color="text.secondary">
            {quantity} table{quantity > 1 ? 's' : ''} × {targetSeatCount} seats = {quantity * targetSeatCount} total seats
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              startIcon={<Check />}
              color="success"
            >
              Create {quantity} Table{quantity > 1 ? 's' : ''}
            </Button>
          </Stack>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}