// components/molecules/AddTableModal.tsx
// V2 Template System - Opens TemplateCustomizationModal when a template is selected
// Features: Template selection, custom table creation

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
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  FilterList,
  Add,
  Edit,
  ContentCopy,
  Delete,
  Check,
  Circle,
  Rectangle,
} from '@mui/icons-material';

// V2 Types
import {
  TableTemplateV2,
  CreateTemplateInputV2,
  EventType,
  SeatMode,
  getTotalSeatCountV2,
  SESSION_TYPE_COLORS_V2,
  isCircleConfigV2,
  isRectangleConfigV2,
} from '@/types/TemplateV2';

// V2 Store
import {
  useTemplateStoreV2,
} from '@/store/templateStoreV2';

// Modals
import CreateEditTemplateModalV2 from './CreateEditTemplateModalV2';
import TemplateCustomizationModal, { CustomizedTableConfig } from './TemplateCustomizationModal';

// Reusable components
import TablePreview from '../atoms/TablePreview';
import ScrollablePreviewContainer from '../atoms/ScrollablePreviewContainer';
import SeatOrderingPanel from './SeatOrderingPanel';
import SeatModePanel from './SeatModePanel';

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
  templateId?: string;
}

interface AddTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: TableConfig) => void;
  sessionType?: EventType | null;
}

type TopLevelTab = 'templates' | 'custom';
type CustomTabValue = 'config' | 'ordering' | 'modes';

// ============================================================================
// TEMPLATE CARD COMPONENT
// ============================================================================

interface TemplateCardProps {
  template: TableTemplateV2;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function TemplateCard({
  template,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: TemplateCardProps) {
  const seatCount = getTotalSeatCountV2(template.config);
  const isCircle = isCircleConfigV2(template.config);

  const previewData = useMemo(() => {
    if (isCircleConfigV2(template.config)) {
      return {
        type: 'round' as const,
        roundSeats: template.config.baseSeatCount,
        rectangleSeats: undefined,
      };
    } else {
      const sides = template.config.sides;
      return {
        type: 'rectangle' as const,
        roundSeats: undefined,
        rectangleSeats: {
          top: sides.top.enabled ? sides.top.seatCount : 0,
          right: sides.right.enabled ? sides.right.seatCount : 0,
          bottom: sides.bottom.enabled ? sides.bottom.seatCount : 0,
          left: sides.left.enabled ? sides.left.seatCount : 0,
        },
      };
    }
  }, [template.config]);

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        cursor: 'pointer',
        border: '2px solid transparent',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: '#e3f2fd',
          transform: 'translateY(-2px)',
          borderColor: '#1976d2',
          boxShadow: 3,
        },
        position: 'relative',
        minHeight: 200,
      }}
      onClick={onSelect}
    >
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {isCircle ? <Circle fontSize="small" /> : <Rectangle fontSize="small" />}
          <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ flex: 1 }}>
            {template.name}
          </Typography>
          {template.isBuiltIn && (
            <Chip label="Built-in" size="small" sx={{ height: 18, fontSize: 10 }} />
          )}
        </Stack>

        {/* Table Preview */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 1,
            minHeight: 90,
          }}
        >
          <TablePreview
            type={previewData.type}
            roundSeats={previewData.roundSeats}
            rectangleSeats={previewData.rectangleSeats}
            seatOrdering={Array(seatCount).fill(0).map((_, i) => i + 1)}
            seatModes={Array(seatCount).fill('default' as SeatMode)}
            size="small"
            showLabels={false}
          />
        </Box>

        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          {template.sessionTypes.slice(0, 2).map((type) => (
            <Chip
              key={type}
              label={type}
              size="small"
              sx={{
                bgcolor: SESSION_TYPE_COLORS_V2[type],
                color: 'white',
                fontSize: 9,
                height: 18,
              }}
            />
          ))}
          {template.sessionTypes.length > 2 && (
            <Chip label={`+${template.sessionTypes.length - 2}`} size="small" sx={{ height: 18, fontSize: 9 }} />
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          {seatCount} seats (base)
        </Typography>

        {/* Actions */}
        <Stack
          direction="row"
          spacing={0.5}
          onClick={(e) => e.stopPropagation()}
        >
          {!template.isBuiltIn && (
            <Tooltip title="Edit Template">
              <IconButton size="small" onClick={onEdit}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Duplicate Template">
            <IconButton size="small" onClick={onDuplicate}>
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
          {!template.isBuiltIn && (
            <Tooltip title="Delete Template">
              <IconButton size="small" onClick={onDelete} color="error">
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AddTableModal({
  open,
  onClose,
  onConfirm,
  sessionType = null,
}: AddTableModalProps) {
  // ============================================================================
  // TAB STATE
  // ============================================================================

  const [topTab, setTopTab] = useState<TopLevelTab>('templates');
  const [customTab, setCustomTab] = useState<CustomTabValue>('config');

  // ============================================================================
  // V2 TEMPLATE STATE
  // ============================================================================

  const templates = useTemplateStoreV2((s) => s.templates);
  const createTemplate = useTemplateStoreV2((s) => s.createTemplate);
  const updateTemplate = useTemplateStoreV2((s) => s.updateTemplate);
  const deleteTemplate = useTemplateStoreV2((s) => s.deleteTemplate);
  const duplicateTemplate = useTemplateStoreV2((s) => s.duplicateTemplate);

  const [filterSessionType, setFilterSessionType] = useState<EventType | null>(sessionType);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TableTemplateV2 | null>(null);

  // Template customization modal
  const [customizationModalOpen, setCustomizationModalOpen] = useState(false);
  const [selectedTemplateForCustomization, setSelectedTemplateForCustomization] = useState<TableTemplateV2 | null>(null);

  // ============================================================================
  // CUSTOM TABLE STATE
  // ============================================================================

  const [customTableType, setCustomTableType] = useState<'round' | 'rectangle'>('round');
  const [roundSeats, setRoundSeats] = useState(8);
  const [rectangleSeats, setRectangleSeats] = useState({
    top: 3, bottom: 3, left: 1, right: 1,
  });
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customLabel, setCustomLabel] = useState('');
  const [seatOrdering, setSeatOrdering] = useState<number[]>([]);
  const [seatModes, setSeatModes] = useState<SeatMode[]>([]);
  const [resetKey, setResetKey] = useState(0);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredTemplates = useMemo(() => {
    if (!filterSessionType) return templates;
    return templates.filter((t) => t.sessionTypes.includes(filterSessionType));
  }, [templates, filterSessionType]);

  const customSeatCount = useMemo(() => {
    if (customTableType === 'round') return roundSeats;
    return rectangleSeats.top + rectangleSeats.bottom + rectangleSeats.left + rectangleSeats.right;
  }, [customTableType, roundSeats, rectangleSeats]);

  const defaultOrdering = useMemo(() =>
    Array(customSeatCount).fill(0).map((_, i) => i + 1),
    [customSeatCount]
  );

  const defaultModes = useMemo(() =>
    Array(customSeatCount).fill('default' as SeatMode),
    [customSeatCount]
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (open) {
      setFilterSessionType(sessionType);
      setTopTab('templates');
      setCustomTab('config');
      setCustomizationModalOpen(false);
      setSelectedTemplateForCustomization(null);
    }
  }, [open, sessionType]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Template handlers
  const handleTemplateSelect = (template: TableTemplateV2) => {
    setSelectedTemplateForCustomization(template);
    setCustomizationModalOpen(true);
  };

  const handleTemplateEdit = (template: TableTemplateV2) => {
    setEditingTemplate(template);
    setTemplateModalOpen(true);
  };

  const handleTemplateDuplicate = (template: TableTemplateV2) => {
    duplicateTemplate(template.id);
  };

  const handleTemplateDelete = (template: TableTemplateV2) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      deleteTemplate(template.id);
    }
  };

  const handleCreateNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateModalOpen(true);
  };

  const handleTemplateSave = (templateInput: CreateTemplateInputV2) => {
    if (editingTemplate && !editingTemplate.isBuiltIn) {
      updateTemplate(editingTemplate.id, templateInput);
    } else {
      createTemplate(templateInput);
    }
  };

  // Customization modal confirm - creates the table(s)
  const handleCustomizationConfirm = (customized: CustomizedTableConfig) => {
    const config: TableConfig = {
      type: customized.rectangleSeats ? 'rectangle' : 'round',
      roundSeats: customized.rectangleSeats ? undefined : customized.seatCount,
      rectangleSeats: customized.rectangleSeats,
      quantity: customized.quantity,
      label: '',
      seatOrdering: customized.seatOrdering,
      seatModes: customized.seatModes,
      templateId: customized.templateId,
    };

    onConfirm(config);
    setCustomizationModalOpen(false);
    setSelectedTemplateForCustomization(null);
    onClose();
  };

  const handleOrderingChange = useCallback((ordering: number[]) => {
    console.log('handleOrderingChange called with ModifyTableModal:', ordering);
    setSeatOrdering(ordering);
  }, []);

  const handleModesChange = useCallback((modes: SeatMode[]) => {
    setSeatModes(modes);
  }, []);

  const handleConfirmCustom = () => {
    const config: TableConfig = {
      type: customTableType,
      roundSeats: customTableType === 'round' ? roundSeats : undefined,
      rectangleSeats: customTableType === 'rectangle' ? rectangleSeats : undefined,
      quantity: customQuantity,
      label: customLabel,
      seatOrdering: seatOrdering.length === customSeatCount ? seatOrdering : defaultOrdering,
      seatModes: seatModes.length === customSeatCount ? seatModes : defaultModes,
    };

    onConfirm(config);
    handleClose();
  };

  const handleClose = () => {
    setCustomTab('config');
    setSeatModes([]);
    setSeatOrdering([]);
    setCustomizationModalOpen(false);
    setSelectedTemplateForCustomization(null);
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
          </Stack>
        </DialogTitle>

        {/* Top Level Tabs */}
        <Tabs
          value={topTab}
          onChange={(_, v) => setTopTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
        >
          <Tab label="From Template" value="templates" />
          <Tab label="Custom Table" value="custom" />
        </Tabs>

        {/* ================================================================== */}
        {/* TEMPLATES TAB */}
        {/* ================================================================== */}
        {topTab === 'templates' && (
          <DialogContent sx={{ minHeight: 500 }}>
            {/* Session Type Filter */}
            <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <FilterList color="action" />
                <Typography variant="subtitle2">Filter:</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
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
                          bgcolor: filterSessionType === type ? SESSION_TYPE_COLORS_V2[type] : 'transparent',
                          color: filterSessionType === type ? 'white' : 'text.primary',
                          borderColor: SESSION_TYPE_COLORS_V2[type],
                        }}
                        variant={filterSessionType === type ? 'filled' : 'outlined'}
                      />
                    )
                  )}
                </Stack>
              </Stack>
            </Paper>

            {/* Template Grid */}
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Click a template to customize and create tables
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 2,
                mt: 2,
              }}
            >
              {/* Create New Card */}
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  border: '2px dashed #ccc',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 200,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#1976d2', bgcolor: '#e3f2fd' },
                }}
                onClick={handleCreateNewTemplate}
              >
                <Add sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                <Typography variant="subtitle2" color="primary">
                  Create Template
                </Typography>
              </Paper>

              {/* Template Cards */}
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => handleTemplateSelect(template)}
                  onEdit={() => handleTemplateEdit(template)}
                  onDuplicate={() => handleTemplateDuplicate(template)}
                  onDelete={() => handleTemplateDelete(template)}
                />
              ))}

              {filteredTemplates.length === 0 && (
                <Paper sx={{ p: 3, gridColumn: 'span 2', textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No templates found. Create one to get started!
                  </Typography>
                </Paper>
              )}
            </Box>
          </DialogContent>
        )}

        {/* ================================================================== */}
        {/* CUSTOM TABLE TAB */}
        {/* ================================================================== */}
        {topTab === 'custom' && (
          <>
            <Tabs
              value={customTab}
              onChange={(_, v) => setCustomTab(v)}
              sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
            >
              <Tab label="Configuration" value="config" />
              <Tab label="Seat Order" value="ordering" />
              <Tab label="Seat Modes" value="modes" />
            </Tabs>

            <DialogContent>
              {/* Configuration Tab */}
              {customTab === 'config' && (
                <Stack spacing={3}>
                  {/* Table Type */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>Table Shape</Typography>
                    <ToggleButtonGroup
                      value={customTableType}
                      exclusive
                      onChange={(_, v) => v && setCustomTableType(v)}
                      size="large"
                    >
                      <ToggleButton value="round" sx={{ px: 4 }}>
                        <Stack alignItems="center" spacing={0.5}>
                          <Circle />
                          <Typography variant="caption">Round</Typography>
                        </Stack>
                      </ToggleButton>
                      <ToggleButton value="rectangle" sx={{ px: 4 }}>
                        <Stack alignItems="center" spacing={0.5}>
                          <Rectangle />
                          <Typography variant="caption">Rectangle</Typography>
                        </Stack>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  <Divider />

                  {/* Round Configuration */}
                  {customTableType === 'round' && (
                    <TextField
                      label="Number of Seats"
                      type="number"
                      value={roundSeats}
                      onChange={(e) => setRoundSeats(Math.max(2, parseInt(e.target.value) || 2))}
                      inputProps={{ min: 2, max: 30 }}
                      sx={{ width: 150 }}
                    />
                  )}

                  {/* Rectangle Configuration */}
                  {customTableType === 'rectangle' && (
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={2}>
                        <TextField
                          label="Top Seats"
                          type="number"
                          value={rectangleSeats.top}
                          onChange={(e) => setRectangleSeats(prev => ({
                            ...prev,
                            top: Math.max(0, parseInt(e.target.value) || 0)
                          }))}
                          inputProps={{ min: 0, max: 15 }}
                          size="small"
                        />
                        <TextField
                          label="Bottom Seats"
                          type="number"
                          value={rectangleSeats.bottom}
                          onChange={(e) => setRectangleSeats(prev => ({
                            ...prev,
                            bottom: Math.max(0, parseInt(e.target.value) || 0)
                          }))}
                          inputProps={{ min: 0, max: 15 }}
                          size="small"
                        />
                      </Stack>
                      <Stack direction="row" spacing={2}>
                        <TextField
                          label="Left Seats"
                          type="number"
                          value={rectangleSeats.left}
                          onChange={(e) => setRectangleSeats(prev => ({
                            ...prev,
                            left: Math.max(0, parseInt(e.target.value) || 0)
                          }))}
                          inputProps={{ min: 0, max: 15 }}
                          size="small"
                        />
                        <TextField
                          label="Right Seats"
                          type="number"
                          value={rectangleSeats.right}
                          onChange={(e) => setRectangleSeats(prev => ({
                            ...prev,
                            right: Math.max(0, parseInt(e.target.value) || 0)
                          }))}
                          inputProps={{ min: 0, max: 15 }}
                          size="small"
                        />
                      </Stack>
                    </Stack>
                  )}

                  <Divider />

                  {/* Quantity */}
                  <TextField
                    label="Number of Tables"
                    type="number"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    inputProps={{ min: 1, max: 20 }}
                    sx={{ width: 150 }}
                  />

                  {/* Preview */}
                  <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Preview ({customSeatCount} seats)
                    </Typography>
                    <ScrollablePreviewContainer maxHeight={280}>
                      <TablePreview
                        type={customTableType}
                        roundSeats={customTableType === 'round' ? roundSeats : undefined}
                        rectangleSeats={customTableType === 'rectangle' ? rectangleSeats : undefined}
                        seatOrdering={seatOrdering.length === customSeatCount ? seatOrdering : defaultOrdering}
                        seatModes={seatModes.length === customSeatCount ? seatModes : defaultModes}
                        size="medium"
                        showLabels
                      />
                    </ScrollablePreviewContainer>
                  </Paper>
                </Stack>
              )}

              {/* Ordering Tab */}
              {customTab === 'ordering' && (
                <SeatOrderingPanel
                  tableType={customTableType}
                  roundSeats={customTableType === 'round' ? roundSeats : undefined}
                  rectangleSeats={customTableType === 'rectangle' ? rectangleSeats : undefined}
                  seatModes={seatModes.length === customSeatCount ? seatModes : defaultModes}
                  onOrderingChange={handleOrderingChange}
                  previewSize="large"
                  maxPreviewHeight={380}
                  showModeToggle={true}
                  resetKey={resetKey}
                />
              )}

              {/* Modes Tab */}
              {customTab === 'modes' && (
                <SeatModePanel
                  tableType={customTableType}
                  roundSeats={customTableType === 'round' ? roundSeats : undefined}
                  rectangleSeats={customTableType === 'rectangle' ? rectangleSeats : undefined}
                  seatOrdering={seatOrdering.length === customSeatCount ? seatOrdering : defaultOrdering}
                  seatModes={seatModes.length === customSeatCount ? seatModes : defaultModes}
                  onModesChange={handleModesChange}
                  previewSize="large"
                  maxPreviewHeight={380}
                  showResetButton={true}
                  resetKey={resetKey}
                />
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleConfirmCustom}
                disabled={customSeatCount < 2}
              >
                Add {customQuantity > 1 ? `${customQuantity} Tables` : 'Table'}
              </Button>
            </DialogActions>
          </>
        )}

        {/* Templates tab has no footer actions - clicking template opens customization modal */}
        {topTab === 'templates' && (
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleClose}>Cancel</Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Template CRUD Modal */}
      <CreateEditTemplateModalV2
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleTemplateSave}
        editTemplate={editingTemplate}
        initialSessionType={filterSessionType}
      />

      {/* Template Customization Modal */}
      <TemplateCustomizationModal
        open={customizationModalOpen}
        onClose={() => {
          setCustomizationModalOpen(false);
          setSelectedTemplateForCustomization(null);
        }}
        onConfirm={handleCustomizationConfirm}
        template={selectedTemplateForCustomization}
      />
    </>
  );
}