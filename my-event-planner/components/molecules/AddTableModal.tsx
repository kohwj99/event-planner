// components/molecules/AddTableModal.tsx
// ENHANCED WITH SUGGESTED TAB, TEMPLATES, AND REUSABLE COMPONENTS
// This modal now supports both template-based and custom table creation

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
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  IconButton,
} from '@mui/material';
import { Refresh, Person, Public, RadioButtonUnchecked, FilterList } from '@mui/icons-material';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';
import { EventType } from '@/types/Event';
import { Direction, OrderingPattern, SESSION_TYPE_COLORS, TableTemplate } from '@/types/Template';
import { useTemplateStore } from '@/store/templateStore';
import { generateOrdering, getTemplateBaseSeatCount, scaleTemplate } from '@/utils/templateScaler';
import { TemplateGrid } from './TemplateCard';
import SeatOrderingControls, { PatternPreview } from './SeatOrderingControls';
import SeatModeControls, { SeatModeLegend, SeatModeMenu } from './SeatModeControls';
import CreateEditTemplateModal from './CreateEditTemplateModal';
import TablePreview from '../atoms/TablePreview';


// ============================================================================
// TYPES
// ============================================================================

export interface TableConfig {
  type: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  quantity: number;
  label: string;
  seatOrdering?: number[];
  seatModes?: SeatMode[];
}

interface AddTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: TableConfig) => void;
  sessionType?: EventType | null; // Optional: filter templates by session type
}

type TopLevelTab = 'suggested' | 'custom';
type CustomTabValue = 'config' | 'ordering' | 'modes';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AddTableModal({ 
  open, 
  onClose, 
  onConfirm,
  sessionType = null,
}: AddTableModalProps) {
  // Top level tab (suggested vs custom)
  const [topTab, setTopTab] = useState<TopLevelTab>('suggested');
  
  // Custom tab sub-tabs
  const [customTab, setCustomTab] = useState<CustomTabValue>('config');

  // Template store
  const templates = useTemplateStore((s) => s.templates);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const duplicateTemplate = useTemplateStore((s) => s.duplicateTemplate);

  // Selected template state
  const [selectedTemplate, setSelectedTemplate] = useState<TableTemplate | null>(null);
  const [templateSeatCount, setTemplateSeatCount] = useState<number>(8);
  const [templateQuantity, setTemplateQuantity] = useState<number>(1);
  const [templateLabel, setTemplateLabel] = useState<string>('');

  // Template CRUD modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TableTemplate | null>(null);

  // Session type filter
  const [filterSessionType, setFilterSessionType] = useState<EventType | null>(sessionType);

  // Custom table configuration
  const [tableConfig, setTableConfig] = useState<TableConfig>({
    type: 'round',
    roundSeats: 8,
    rectangleSeats: { top: 2, bottom: 2, left: 1, right: 1 },
    quantity: 1,
    label: '',
  });

  // Ordering configuration
  const [direction, setDirection] = useState<Direction>('counter-clockwise');
  const [orderingPattern, setOrderingPattern] = useState<OrderingPattern>('sequential');
  const [startPosition, setStartPosition] = useState<number>(0);

  // Seat modes
  const [seatModes, setSeatModes] = useState<SeatMode[]>([]);

  // Menu state for seat mode selection
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Calculate total seats for custom tab
  const totalSeats = useMemo(() => {
    if (tableConfig.type === 'round') {
      return tableConfig.roundSeats || 8;
    }
    const { top = 0, bottom = 0, left = 0, right = 0 } = tableConfig.rectangleSeats || {};
    return top + bottom + left + right;
  }, [tableConfig]);

  // Generate ordering for custom tab
  const seatOrdering = useMemo(() => {
    const rectangleConfig = tableConfig.type === 'rectangle' 
      ? tableConfig.rectangleSeats 
      : undefined;
    return generateOrdering(totalSeats, direction, orderingPattern, startPosition, rectangleConfig);
  }, [totalSeats, direction, orderingPattern, startPosition, tableConfig]);

  // Filter templates by session type
  const filteredTemplates = useMemo(() => {
    if (!filterSessionType) return templates;
    return templates.filter((t) => t.sessionTypes.includes(filterSessionType));
  }, [templates, filterSessionType]);

  // Scaled template result (when a template is selected)
  const scaledTemplateResult = useMemo(() => {
    if (!selectedTemplate) return null;
    return scaleTemplate(selectedTemplate, templateSeatCount);
  }, [selectedTemplate, templateSeatCount]);

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

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize seat modes when seat count changes
  useEffect(() => {
    setSeatModes((prev) => {
      if (prev.length === totalSeats) return prev;
      if (totalSeats > prev.length) {
        return [...prev, ...Array(totalSeats - prev.length).fill('default' as SeatMode)];
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

  // Update template seat count when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const baseSeatCount = getTemplateBaseSeatCount(selectedTemplate);
      setTemplateSeatCount(baseSeatCount);
    }
  }, [selectedTemplate]);

  // Update filter when sessionType prop changes
  useEffect(() => {
    setFilterSessionType(sessionType);
  }, [sessionType]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      // Keep the current tab but reset selections
      setSelectedTemplate(null);
      setTemplateQuantity(1);
      setTemplateLabel('');
      setCustomTab('config');
    }
  }, [open]);

  // ============================================================================
  // HANDLERS - CUSTOM TAB
  // ============================================================================

  const handleResetOrdering = () => {
    setDirection('counter-clockwise');
    setOrderingPattern('sequential');
    setStartPosition(0);
  };

  const handleResetModes = () => {
    setSeatModes(Array.from({ length: totalSeats }, () => 'default' as SeatMode));
  };

  const handleSeatModeChange = (index: number, mode: SeatMode) => {
    setSeatModes((prev) => {
      const newModes = [...prev];
      newModes[index] = mode;
      return newModes;
    });
  };

  const handleSetAllModes = (mode: SeatMode) => {
    setSeatModes(Array.from({ length: totalSeats }, () => mode));
  };

  const handleSeatClick = (event: React.MouseEvent, index: number) => {
    if (customTab === 'modes') {
      setMenuAnchor(event.currentTarget as HTMLElement);
      setSelectedSeatIndex(index);
    } else if (customTab === 'ordering') {
      setStartPosition(index);
    }
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedSeatIndex(null);
  };

  const handleMenuSelect = (mode: SeatMode) => {
    if (selectedSeatIndex !== null) {
      handleSeatModeChange(selectedSeatIndex, mode);
    }
    handleMenuClose();
  };

  // ============================================================================
  // HANDLERS - TEMPLATE TAB
  // ============================================================================

  const handleTemplateSelect = (template: TableTemplate) => {
    setSelectedTemplate(template);
    setTemplateSeatCount(getTemplateBaseSeatCount(template));
  };

  const handleTemplateEdit = (template: TableTemplate) => {
    setEditingTemplate(template);
    setTemplateModalOpen(true);
  };

  const handleTemplateDuplicate = (template: TableTemplate) => {
    duplicateTemplate(template.id);
  };

  const handleTemplateDelete = (template: TableTemplate) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteTemplate(template.id);
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null);
      }
    }
  };

  const handleCreateNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateModalOpen(true);
  };

  const handleTemplateSave = (templateInput: any) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, templateInput);
    } else {
      createTemplate(templateInput);
    }
  };

  // ============================================================================
  // CONFIRM HANDLERS
  // ============================================================================

  const handleConfirmCustom = () => {
    onConfirm({
      ...tableConfig,
      seatOrdering,
      seatModes,
    });
    handleClose();
  };

  const handleConfirmTemplate = () => {
    if (!selectedTemplate || !scaledTemplateResult) return;

    const config: TableConfig = {
      type: scaledTemplateResult.type,
      roundSeats: scaledTemplateResult.roundSeats,
      rectangleSeats: scaledTemplateResult.rectangleSeats,
      quantity: templateQuantity,
      label: templateLabel,
      seatOrdering: scaledTemplateResult.seatOrdering,
      seatModes: scaledTemplateResult.seatModes,
    };

    onConfirm(config);
    handleClose();
  };

  const handleClose = () => {
    // Reset state
    setCustomTab('config');
    setDirection('counter-clockwise');
    setOrderingPattern('sequential');
    setStartPosition(0);
    setSeatModes([]);
    setSelectedTemplate(null);
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Add Table</Typography>
            {topTab === 'custom' && customTab !== 'config' && (
              <Button
                size="small"
                startIcon={<Refresh />}
                onClick={customTab === 'ordering' ? handleResetOrdering : handleResetModes}
                variant="outlined"
              >
                Reset
              </Button>
            )}
          </Stack>
        </DialogTitle>

        {/* Top Level Tabs */}
        <Tabs
          value={topTab}
          onChange={(_, v) => setTopTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
        >
          <Tab label="Suggested Templates" value="suggested" />
          <Tab label="Custom Table" value="custom" />
        </Tabs>

        {/* ================================================================== */}
        {/* SUGGESTED TAB */}
        {/* ================================================================== */}
        {topTab === 'suggested' && (
          <>
            <DialogContent sx={{ minHeight: 500 }}>
              {/* Session Type Filter */}
              <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FilterList color="action" />
                  <Typography variant="subtitle2">Filter by Session Type:</Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label="All"
                      onClick={() => setFilterSessionType(null)}
                      color={filterSessionType === null ? 'primary' : 'default'}
                      variant={filterSessionType === null ? 'filled' : 'outlined'}
                    />
                    {(['Executive meeting', 'Bilateral Meeting', 'Meal', 'Phototaking'] as EventType[]).map(
                      (type) => (
                        <Chip
                          key={type}
                          label={type}
                          onClick={() => setFilterSessionType(type)}
                          sx={{
                            bgcolor:
                              filterSessionType === type
                                ? SESSION_TYPE_COLORS[type]
                                : 'transparent',
                            color: filterSessionType === type ? 'white' : 'text.primary',
                            borderColor: SESSION_TYPE_COLORS[type],
                          }}
                          variant={filterSessionType === type ? 'filled' : 'outlined'}
                        />
                      )
                    )}
                  </Stack>
                </Stack>
              </Paper>

              {/* Template Grid */}
              <TemplateGrid
                templates={filteredTemplates}
                selectedTemplateId={selectedTemplate?.id}
                onSelect={handleTemplateSelect}
                onEdit={handleTemplateEdit}
                onDuplicate={handleTemplateDuplicate}
                onDelete={handleTemplateDelete}
                onCreateNew={handleCreateNewTemplate}
                showCreateCard={true}
                emptyMessage="No templates found for this session type"
              />

              {/* Selected Template Configuration */}
              {selectedTemplate && scaledTemplateResult && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Paper elevation={0} sx={{ p: 3, bgcolor: '#e3f2fd' }}>
                    <Typography variant="h6" gutterBottom>
                      Configure: {selectedTemplate.name}
                    </Typography>

                    <Stack direction="row" spacing={4} alignItems="flex-start">
                      {/* Preview */}
                      <Box
                        sx={{
                          bgcolor: 'white',
                          p: 2,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TablePreview
                          type={scaledTemplateResult.type}
                          roundSeats={scaledTemplateResult.roundSeats}
                          rectangleSeats={scaledTemplateResult.rectangleSeats}
                          seatOrdering={scaledTemplateResult.seatOrdering}
                          seatModes={scaledTemplateResult.seatModes}
                          size="medium"
                          showLabels={true}
                        />
                      </Box>

                      {/* Configuration */}
                      <Stack spacing={2} sx={{ flex: 1 }}>
                        <Box>
                          <Typography gutterBottom>
                            Number of Seats: {templateSeatCount}
                          </Typography>
                          <Slider
                            value={templateSeatCount}
                            onChange={(_, val) => setTemplateSeatCount(val as number)}
                            min={selectedTemplate.minSeats}
                            max={selectedTemplate.maxSeats}
                            marks={[
                              { value: selectedTemplate.minSeats, label: `${selectedTemplate.minSeats}` },
                              { value: selectedTemplate.maxSeats, label: `${selectedTemplate.maxSeats}` },
                            ]}
                            valueLabelDisplay="auto"
                          />
                        </Box>

                        <TextField
                          label="Number of Tables"
                          type="number"
                          value={templateQuantity}
                          onChange={(e) =>
                            setTemplateQuantity(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          inputProps={{ min: 1, max: 50 }}
                          size="small"
                          sx={{ width: 150 }}
                        />

                        <TextField
                          label="Table Label (optional)"
                          value={templateLabel}
                          onChange={(e) => setTemplateLabel(e.target.value)}
                          placeholder="e.g., VIP Table"
                          size="small"
                          sx={{ width: 250 }}
                        />

                        <Typography variant="body2" color="text.secondary">
                          {/* Pattern: {selectedTemplate.useAlternatingOrder ? 'Alternating' : 'Sequential'}{' '} */}
                          {selectedTemplate.orderingDirection}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                </>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleConfirmTemplate}
                disabled={!selectedTemplate}
              >
                Add {templateQuantity > 1 ? `${templateQuantity} Tables` : 'Table'}
              </Button>
            </DialogActions>
          </>
        )}

        {/* ================================================================== */}
        {/* CUSTOM TAB */}
        {/* ================================================================== */}
        {topTab === 'custom' && (
          <>
            {/* Sub-tabs for custom configuration */}
            <Tabs
              value={customTab}
              onChange={(_, v) => setCustomTab(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 3, bgcolor: '#fafafa' }}
            >
              <Tab label="Table Configuration" value="config" />
              <Tab label="Seat Ordering" value="ordering" />
              <Tab label="Seat Modes" value="modes" />
            </Tabs>

            <DialogContent sx={{ minHeight: 500 }}>
              {/* CONFIG TAB */}
              {customTab === 'config' && (
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Table Type</InputLabel>
                    <Select
                      value={tableConfig.type}
                      label="Table Type"
                      onChange={(e) =>
                        setTableConfig((prev) => ({
                          ...prev,
                          type: e.target.value as 'round' | 'rectangle',
                        }))
                      }
                    >
                      <MenuItem value="round">Round Table</MenuItem>
                      <MenuItem value="rectangle">Rectangle Table</MenuItem>
                    </Select>
                  </FormControl>

                  {tableConfig.type === 'round' ? (
                    <Box>
                      <Typography gutterBottom>
                        Number of Seats: {tableConfig.roundSeats}
                      </Typography>
                      <Slider
                        value={tableConfig.roundSeats || 8}
                        onChange={(_, val) =>
                          setTableConfig((prev) => ({ ...prev, roundSeats: val as number }))
                        }
                        min={4}
                        max={20}
                        marks
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  ) : (
                    <Stack direction="row" spacing={2}>
                      <TextField
                        label="Top"
                        type="number"
                        value={tableConfig.rectangleSeats?.top || 0}
                        onChange={(e) =>
                          setTableConfig((prev) => ({
                            ...prev,
                            rectangleSeats: {
                              ...prev.rectangleSeats!,
                              top: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          }))
                        }
                        inputProps={{ min: 0, max: 10 }}
                      />
                      <TextField
                        label="Bottom"
                        type="number"
                        value={tableConfig.rectangleSeats?.bottom || 0}
                        onChange={(e) =>
                          setTableConfig((prev) => ({
                            ...prev,
                            rectangleSeats: {
                              ...prev.rectangleSeats!,
                              bottom: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          }))
                        }
                        inputProps={{ min: 0, max: 10 }}
                      />
                      <TextField
                        label="Left"
                        type="number"
                        value={tableConfig.rectangleSeats?.left || 0}
                        onChange={(e) =>
                          setTableConfig((prev) => ({
                            ...prev,
                            rectangleSeats: {
                              ...prev.rectangleSeats!,
                              left: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          }))
                        }
                        inputProps={{ min: 0, max: 5 }}
                      />
                      <TextField
                        label="Right"
                        type="number"
                        value={tableConfig.rectangleSeats?.right || 0}
                        onChange={(e) =>
                          setTableConfig((prev) => ({
                            ...prev,
                            rectangleSeats: {
                              ...prev.rectangleSeats!,
                              right: Math.max(0, parseInt(e.target.value) || 0),
                            },
                          }))
                        }
                        inputProps={{ min: 0, max: 5 }}
                      />
                    </Stack>
                  )}

                  <Divider />

                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="Number of Tables"
                      type="number"
                      value={tableConfig.quantity}
                      onChange={(e) =>
                        setTableConfig((prev) => ({
                          ...prev,
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      inputProps={{ min: 1, max: 50 }}
                      sx={{ width: 150 }}
                    />
                    <TextField
                      label="Table Label (optional)"
                      value={tableConfig.label}
                      onChange={(e) =>
                        setTableConfig((prev) => ({ ...prev, label: e.target.value }))
                      }
                      placeholder="e.g., VIP Table"
                      sx={{ flex: 1 }}
                    />
                  </Stack>

                  {/* Preview */}
                  <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Preview ({totalSeats} seats)
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 200,
                      }}
                    >
                      <TablePreview
                        type={tableConfig.type}
                        roundSeats={tableConfig.roundSeats}
                        rectangleSeats={tableConfig.rectangleSeats}
                        seatOrdering={seatOrdering}
                        seatModes={seatModes}
                        size="medium"
                      />
                    </Box>
                  </Paper>
                </Stack>
              )}

              {/* ORDERING TAB */}
              {customTab === 'ordering' && (
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <SeatOrderingControls
                    direction={direction}
                    orderingPattern={orderingPattern}
                    startPosition={startPosition}
                    totalSeats={totalSeats}
                    onDirectionChange={setDirection}
                    onPatternChange={setOrderingPattern}
                    showResetButton={false}
                    tableType={tableConfig.type}
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
                      type={tableConfig.type}
                      roundSeats={tableConfig.roundSeats}
                      rectangleSeats={tableConfig.rectangleSeats}
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
              {customTab === 'modes' && (
                <Stack spacing={3} sx={{ mt: 2 }}>
                  <SeatModeControls
                    onSetAllModes={handleSetAllModes}
                    showResetButton={false}
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
                      type={tableConfig.type}
                      roundSeats={tableConfig.roundSeats}
                      rectangleSeats={tableConfig.rectangleSeats}
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
                    anchorEl={menuAnchor}
                    onClose={handleMenuClose}
                    onSelect={handleMenuSelect}
                    currentMode={selectedSeatIndex !== null ? seatModes[selectedSeatIndex] : 'default'}
                  />
                </Stack>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button variant="contained" onClick={handleConfirmCustom}>
                Add {tableConfig.quantity > 1 ? `${tableConfig.quantity} Tables` : 'Table'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Template CRUD Modal */}
      <CreateEditTemplateModal
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleTemplateSave}
        editTemplate={editingTemplate}
        initialSessionType={filterSessionType}
      />
    </>
  );
}