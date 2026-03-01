'use client';

import { useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Divider,
  TextField,
  Slider,
  Select,
  MenuItem,
  Button,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  NearMe,
  CropSquare,
  CircleOutlined,
  HorizontalRule,
  TextFields,
  Delete,
  VerticalAlignTop,
  VerticalAlignBottom,
  FormatBold,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
} from '@mui/icons-material';
import { useSeatStore } from '@/store/seatStore';
import { useDrawUIStore, DrawTool } from '@/store/drawUIStore';
import { useCaptureSnapshot } from '@/components/providers/UndoRedoProvider';
import { DrawObjectStyle, DrawObjectText } from '@/types/DrawObject';
import { getAllShapes } from '@/utils/drawShapeRegistry';

interface DrawRightConfigPanelProps {
  isLocked?: boolean;
}

/** Map tool names to MUI icons */
const TOOL_ICONS: Record<string, React.ReactNode> = {
  select: <NearMe fontSize="small" />,
  rectangle: <CropSquare fontSize="small" />,
  ellipse: <CircleOutlined fontSize="small" />,
  line: <HorizontalRule fontSize="small" />,
  textbox: <TextFields fontSize="small" />,
};

export default function DrawRightConfigPanel({
  isLocked = false,
}: DrawRightConfigPanelProps) {
  const captureSnapshot = useCaptureSnapshot();

  // Draw UI store
  const activeDrawTool = useDrawUIStore((s) => s.activeDrawTool);
  const setActiveDrawTool = useDrawUIStore((s) => s.setActiveDrawTool);

  // Seat store (draw objects)
  const drawObjects = useSeatStore((s) => s.drawObjects);
  const selectedDrawObjectId = useSeatStore((s) => s.selectedDrawObjectId);
  const updateDrawObject = useSeatStore((s) => s.updateDrawObject);
  const deleteDrawObject = useSeatStore((s) => s.deleteDrawObject);

  const selectedObj = drawObjects.find((o) => o.id === selectedDrawObjectId) ?? null;

  // Get registered shapes for tool picker
  const shapes = getAllShapes();

  // Shape config for selected object
  const selectedShapeConfig = selectedObj
    ? shapes.find((s) => s.shape === selectedObj.shape)?.config
    : null;

  const handleStyleChange = useCallback(
    (field: keyof DrawObjectStyle, value: string | number) => {
      if (!selectedObj) return;
      captureSnapshot('Style Draw Object');
      updateDrawObject(selectedObj.id, {
        style: { ...selectedObj.style, [field]: value },
      });
    },
    [selectedObj, captureSnapshot, updateDrawObject],
  );

  const handleTextChange = useCallback(
    (field: keyof DrawObjectText, value: string | number) => {
      if (!selectedObj) return;
      captureSnapshot('Edit Draw Object');
      updateDrawObject(selectedObj.id, {
        text: { ...(selectedObj.text ?? { content: '', fontSize: 14, fontWeight: 'normal' as const, textAlign: 'center' as const, color: '#212121' }), [field]: value },
      });
    },
    [selectedObj, captureSnapshot, updateDrawObject],
  );

  const handleDelete = useCallback(() => {
    if (!selectedObj) return;
    captureSnapshot('Delete Draw Object');
    deleteDrawObject(selectedObj.id);
  }, [selectedObj, captureSnapshot, deleteDrawObject]);

  const handleBringToFront = useCallback(() => {
    if (!selectedObj) return;
    const maxZ = Math.max(...drawObjects.map((o) => o.zIndex), 0);
    captureSnapshot('Edit Draw Object');
    updateDrawObject(selectedObj.id, { zIndex: maxZ + 1 });
  }, [selectedObj, drawObjects, captureSnapshot, updateDrawObject]);

  const handleSendToBack = useCallback(() => {
    if (!selectedObj) return;
    const minZ = Math.min(...drawObjects.map((o) => o.zIndex), 0);
    captureSnapshot('Edit Draw Object');
    updateDrawObject(selectedObj.id, { zIndex: minZ - 1 });
  }, [selectedObj, drawObjects, captureSnapshot, updateDrawObject]);

  return (
    <Box p={2} sx={{ width: 320 }}>
      {isLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Session is locked. Drawing is disabled.
        </Alert>
      )}

      {/* ============ TOOL PICKER ============ */}
      <Typography variant="subtitle2" fontWeight="bold" color="text.primary" gutterBottom>
        Tools
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
        {/* Select tool */}
        <Tooltip title="Select">
          <IconButton
            size="small"
            color={activeDrawTool === 'select' ? 'primary' : 'default'}
            onClick={() => setActiveDrawTool('select')}
            disabled={isLocked}
            sx={{
              border: activeDrawTool === 'select' ? 2 : 1,
              borderColor: activeDrawTool === 'select' ? 'primary.main' : 'divider',
              borderRadius: 1,
            }}
          >
            {TOOL_ICONS.select}
          </IconButton>
        </Tooltip>

        {/* Shape tools from registry */}
        {shapes.map(({ shape, config }) => (
          <Tooltip key={shape} title={config.label}>
            <IconButton
              size="small"
              color={activeDrawTool === shape ? 'primary' : 'default'}
              onClick={() => setActiveDrawTool(shape as DrawTool)}
              disabled={isLocked}
              sx={{
                border: activeDrawTool === shape ? 2 : 1,
                borderColor: activeDrawTool === shape ? 'primary.main' : 'divider',
                borderRadius: 1,
              }}
            >
              {TOOL_ICONS[shape] ?? <CropSquare fontSize="small" />}
            </IconButton>
          </Tooltip>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* ============ SELECTED OBJECT PROPERTIES ============ */}
      {!selectedObj ? (
        <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
          Select an object or draw a new shape
        </Typography>
      ) : (
        <Stack spacing={2}>
          {/* ============ ACTIONS (Delete + Z-order at the top) ============ */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight="bold" color="text.primary" sx={{ flex: 1 }}>
              {selectedShapeConfig?.label ?? selectedObj.shape}
            </Typography>
            <Tooltip title="Bring to Front">
              <IconButton
                size="small"
                onClick={handleBringToFront}
                disabled={isLocked}
              >
                <VerticalAlignTop fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Send to Back">
              <IconButton
                size="small"
                onClick={handleSendToBack}
                disabled={isLocked}
              >
                <VerticalAlignBottom fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={handleDelete}
                disabled={isLocked}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          <Divider />

          {/* ============ POSITION & SIZE ============ */}
          <Typography variant="body2" fontWeight="bold" color="text.primary">
            Position
          </Typography>

          <Stack direction="row" spacing={1}>
            <TextField
              label="X"
              type="number"
              size="small"
              value={Math.round(selectedObj.x)}
              onChange={(e) => {
                captureSnapshot('Move Draw Object');
                updateDrawObject(selectedObj.id, { x: Number(e.target.value) });
              }}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Y"
              type="number"
              size="small"
              value={Math.round(selectedObj.y)}
              onChange={(e) => {
                captureSnapshot('Move Draw Object');
                updateDrawObject(selectedObj.id, { y: Number(e.target.value) });
              }}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
          </Stack>

          <Typography variant="body2" fontWeight="bold" color="text.primary">
            Size
          </Typography>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Width"
              type="number"
              size="small"
              value={Math.round(selectedObj.width)}
              onChange={(e) => {
                captureSnapshot('Resize Draw Object');
                updateDrawObject(selectedObj.id, { width: Math.max(10, Number(e.target.value)) });
              }}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Height"
              type="number"
              size="small"
              value={Math.round(selectedObj.height)}
              onChange={(e) => {
                captureSnapshot('Resize Draw Object');
                updateDrawObject(selectedObj.id, { height: Math.max(10, Number(e.target.value)) });
              }}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
          </Stack>

          <Divider />

          {/* ============ FILL ============ */}
          <Typography variant="body2" fontWeight="bold" color="text.primary">
            Fill
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <input
              type="color"
              value={selectedObj.style.fillColor === 'transparent' ? '#ffffff' : selectedObj.style.fillColor}
              onChange={(e) => handleStyleChange('fillColor', e.target.value)}
              disabled={isLocked}
              style={{ width: 32, height: 32, border: 'none', cursor: 'pointer' }}
            />
            <TextField
              size="small"
              value={selectedObj.style.fillColor}
              onChange={(e) => handleStyleChange('fillColor', e.target.value)}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
            <Tooltip title="Set fill to transparent">
              <Button
                size="small"
                variant={selectedObj.style.fillColor === 'transparent' ? 'contained' : 'outlined'}
                onClick={() => handleStyleChange('fillColor', 'transparent')}
                disabled={isLocked}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                None
              </Button>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 50 }}>
              Opacity
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={selectedObj.style.fillOpacity}
              onChange={(_, v) => handleStyleChange('fillOpacity', v as number)}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" sx={{ minWidth: 30, textAlign: 'right' }}>
              {Math.round(selectedObj.style.fillOpacity * 100)}%
            </Typography>
          </Stack>

          <Divider />

          {/* ============ STROKE / OUTLINE ============ */}
          <Typography variant="body2" fontWeight="bold" color="text.primary">
            Outline
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <input
              type="color"
              value={selectedObj.style.strokeColor === 'transparent' ? '#000000' : selectedObj.style.strokeColor}
              onChange={(e) => handleStyleChange('strokeColor', e.target.value)}
              disabled={isLocked}
              style={{ width: 32, height: 32, border: 'none', cursor: 'pointer' }}
            />
            <TextField
              size="small"
              value={selectedObj.style.strokeColor}
              onChange={(e) => handleStyleChange('strokeColor', e.target.value)}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
            <Tooltip title="Set outline to transparent">
              <Button
                size="small"
                variant={selectedObj.style.strokeColor === 'transparent' ? 'contained' : 'outlined'}
                onClick={() => handleStyleChange('strokeColor', 'transparent')}
                disabled={isLocked}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                None
              </Button>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 50 }}>
              Opacity
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={selectedObj.style.strokeOpacity}
              onChange={(_, v) => handleStyleChange('strokeOpacity', v as number)}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" sx={{ minWidth: 30, textAlign: 'right' }}>
              {Math.round(selectedObj.style.strokeOpacity * 100)}%
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 50 }}>
              Width
            </Typography>
            <Slider
              size="small"
              min={1}
              max={8}
              step={0.5}
              value={selectedObj.style.strokeWidth}
              onChange={(_, v) => handleStyleChange('strokeWidth', v as number)}
              disabled={isLocked}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" sx={{ minWidth: 30, textAlign: 'right' }}>
              {selectedObj.style.strokeWidth}px
            </Typography>
          </Stack>

          {/* ============ TEXT (if shape supports it) ============ */}
          {selectedShapeConfig?.supportsText && (
            <>
              <Divider />
              <Typography variant="body2" fontWeight="bold" color="text.primary">
                Text
              </Typography>

              <TextField
                label="Content"
                multiline
                minRows={2}
                maxRows={4}
                size="small"
                value={selectedObj.text?.content ?? ''}
                onChange={(e) => handleTextChange('content', e.target.value)}
                disabled={isLocked}
                fullWidth
              />

              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <InputLabel>Size</InputLabel>
                  <Select
                    label="Size"
                    value={selectedObj.text?.fontSize ?? 14}
                    onChange={(e) => handleTextChange('fontSize', Number(e.target.value))}
                    disabled={isLocked}
                  >
                    {[10, 12, 14, 16, 20, 24, 32].map((s) => (
                      <MenuItem key={s} value={s}>{s}px</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <ToggleButtonGroup
                  size="small"
                  value={selectedObj.text?.fontWeight ?? 'normal'}
                  exclusive
                  onChange={(_, val) => val && handleTextChange('fontWeight', val)}
                  disabled={isLocked}
                >
                  <ToggleButton value="normal">
                    <Typography variant="caption">N</Typography>
                  </ToggleButton>
                  <ToggleButton value="bold">
                    <FormatBold fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                  size="small"
                  value={selectedObj.text?.textAlign ?? 'center'}
                  exclusive
                  onChange={(_, val) => val && handleTextChange('textAlign', val)}
                  disabled={isLocked}
                >
                  <ToggleButton value="left">
                    <FormatAlignLeft fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="center">
                    <FormatAlignCenter fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="right">
                    <FormatAlignRight fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ minWidth: 50 }}>
                  Color
                </Typography>
                <input
                  type="color"
                  value={selectedObj.text?.color ?? '#212121'}
                  onChange={(e) => handleTextChange('color', e.target.value)}
                  disabled={isLocked}
                  style={{ width: 32, height: 32, border: 'none', cursor: 'pointer' }}
                />
                <TextField
                  size="small"
                  value={selectedObj.text?.color ?? '#212121'}
                  onChange={(e) => handleTextChange('color', e.target.value)}
                  disabled={isLocked}
                  sx={{ flex: 1 }}
                />
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
