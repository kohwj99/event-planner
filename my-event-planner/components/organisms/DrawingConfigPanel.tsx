// components/organisms/DrawingConfigPanel.tsx
// Right panel for drawing mode - shape selection, styling, and management

'use client';

import { useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Slider,
  IconButton,
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Rectangle,
  Circle,
  ChangeHistory,
  ArrowForward,
  Remove,
  FormatBold,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  ContentCopy,
  Delete,
  VerticalAlignTop,
  VerticalAlignBottom,
  ArrowUpward,
  ArrowDownward,
  Add,
  ClearAll,
} from '@mui/icons-material';

import { useDrawingStore } from '@/store/drawingStore';
import { useColorModeStore } from '@/store/colorModeStore';
import {
  DrawingShape,
  DrawingShapeType,
  TextAlignment,
  createDefaultShape,
} from '@/types/DrawingShape';
import {
  getDrawingColors,
  FONT_SIZE_OPTIONS,
  DEFAULT_FONT_SIZE,
} from '@/utils/drawingColorConfig';

// ============================================================================
// SHAPE ICONS
// ============================================================================

const SHAPE_ICONS: Record<DrawingShapeType, React.ReactNode> = {
  rectangle: <Rectangle />,
  ellipse: <Circle />,
  diamond: <ChangeHistory sx={{ transform: 'rotate(180deg)' }} />,
  arrow: <ArrowForward />,
  line: <Remove />,
};

const SHAPE_TYPE_LIST: DrawingShapeType[] = ['rectangle', 'ellipse', 'diamond', 'arrow', 'line'];

// ============================================================================
// COMPONENT
// ============================================================================

interface DrawingConfigPanelProps {
  onAddShape?: (x: number, y: number) => void;
}

export default function DrawingConfigPanel({ onAddShape }: DrawingConfigPanelProps) {
  const colorModeStore = useColorModeStore();
  const isColorblindMode = colorModeStore.colorMode === 'colorblind';
  
  const drawingColors = useMemo(
    () => getDrawingColors(isColorblindMode),
    [isColorblindMode]
  );
  
  // Store state
  const shapes = useDrawingStore((state) => state.shapes);
  const selectedShapeId = useDrawingStore((state) => state.selectedShapeId);
  const currentShapeType = useDrawingStore((state) => state.currentShapeType);
  const currentColor = useDrawingStore((state) => state.currentColor);
  
  // Store actions
  const addShape = useDrawingStore((state) => state.addShape);
  const updateShape = useDrawingStore((state) => state.updateShape);
  const deleteShape = useDrawingStore((state) => state.deleteShape);
  const duplicateShape = useDrawingStore((state) => state.duplicateShape);
  const selectShape = useDrawingStore((state) => state.selectShape);
  const setCurrentShapeType = useDrawingStore((state) => state.setCurrentShapeType);
  const setCurrentColor = useDrawingStore((state) => state.setCurrentColor);
  const bringToFront = useDrawingStore((state) => state.bringToFront);
  const sendToBack = useDrawingStore((state) => state.sendToBack);
  const bringForward = useDrawingStore((state) => state.bringForward);
  const sendBackward = useDrawingStore((state) => state.sendBackward);
  const clearAllShapes = useDrawingStore((state) => state.clearAllShapes);
  
  // Sort shapes by z-index
  const sortedShapes = useMemo(
    () => [...shapes].sort((a, b) => a.zIndex - b.zIndex),
    [shapes]
  );
  
  // Get selected shape
  const selectedShape = useMemo(
    () => shapes.find((s) => s.id === selectedShapeId) || null,
    [shapes, selectedShapeId]
  );
  
  // Safe values with defaults for sliders
  const strokeWidth = selectedShape?.strokeWidth ?? 2;
  const opacity = selectedShape?.opacity ?? 0.85;
  const width = selectedShape?.width ?? 120;
  const height = selectedShape?.height ?? 80;
  const fontSize = selectedShape?.fontSize ?? DEFAULT_FONT_SIZE;
  const fontBold = selectedShape?.fontBold ?? false;
  const textAlign = selectedShape?.textAlign ?? 'center';
  const fillColor = selectedShape?.fillColor ?? '#9C27B0';
  
  // Handle shape type change
  const handleShapeTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: DrawingShapeType | null
  ) => {
    if (newType) {
      setCurrentShapeType(newType);
    }
  };
  
  // Handle color selection
  const handleColorSelect = (color: string) => {
    setCurrentColor(color);
    if (selectedShape) {
      updateShape(selectedShape.id, { fillColor: color, strokeColor: color });
    }
  };
  
  // Handle add shape button click
  const handleAddShapeClick = () => {
    // Create a new shape with proper defaults
    const newShape = createDefaultShape(
      currentShapeType,
      300 + Math.random() * 200,
      200 + Math.random() * 200,
      shapes.length + 1,
      currentColor
    );
    
    console.log('[DrawingConfigPanel] Creating new shape:', newShape);
    
    addShape(newShape);
  };
  
  // Update selected shape property
  const updateSelectedShape = useCallback(
    (updates: Partial<DrawingShape>) => {
      if (selectedShape) {
        updateShape(selectedShape.id, updates);
      }
    },
    [selectedShape, updateShape]
  );
  
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight="bold">
          Drawing Tools
        </Typography>
      </Box>
      
      {/* Scrollable Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <Stack spacing={2}>
          {/* Shape Type Selection */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Shape Type
            </Typography>
            <ToggleButtonGroup
              value={currentShapeType}
              exclusive
              onChange={handleShapeTypeChange}
              size="small"
              fullWidth
              sx={{ mt: 0.5 }}
            >
              {SHAPE_TYPE_LIST.map((type) => (
                <ToggleButton key={type} value={type} sx={{ flex: 1, py: 1 }}>
                  {SHAPE_ICONS[type]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          
          {/* Color Picker */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Color
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
              {drawingColors.map((color) => (
                <IconButton
                  key={color.value}
                  onClick={() => handleColorSelect(color.value)}
                  size="small"
                  title={color.name}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: color.value,
                    border: currentColor === color.value ? 3 : 1,
                    borderColor: currentColor === color.value ? 'primary.main' : 'divider',
                    '&:hover': { bgcolor: color.value, opacity: 0.8 },
                  }}
                />
              ))}
            </Stack>
          </Box>
          
          {/* Add Shape Button */}
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Add />}
            onClick={handleAddShapeClick}
            fullWidth
            size="large"
          >
            Add {currentShapeType.charAt(0).toUpperCase() + currentShapeType.slice(1)}
          </Button>
          
          <Divider />
          
          {/* Selected Shape Editor */}
          {selectedShape ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Edit Selected Shape
              </Typography>
              
              <Stack spacing={1.5}>
                {/* Text Input */}
                <TextField
                  label="Text"
                  value={selectedShape.text || ''}
                  onChange={(e) => updateSelectedShape({ text: e.target.value })}
                  size="small"
                  multiline
                  rows={2}
                  fullWidth
                />
                
                {/* Font Size */}
                <FormControl size="small" fullWidth>
                  <InputLabel>Font Size</InputLabel>
                  <Select
                    value={fontSize}
                    label="Font Size"
                    onChange={(e) => updateSelectedShape({ fontSize: Number(e.target.value) })}
                  >
                    {FONT_SIZE_OPTIONS.map((size) => (
                      <MenuItem key={size} value={size}>
                        {size}px
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {/* Text Style */}
                <Stack direction="row" spacing={1}>
                  <ToggleButton
                    value="bold"
                    selected={fontBold}
                    onChange={() => updateSelectedShape({ fontBold: !fontBold })}
                    size="small"
                  >
                    <FormatBold />
                  </ToggleButton>
                  
                  <ToggleButtonGroup
                    value={textAlign}
                    exclusive
                    onChange={(_, v) => v && updateSelectedShape({ textAlign: v as TextAlignment })}
                    size="small"
                  >
                    <ToggleButton value="left">
                      <FormatAlignLeft />
                    </ToggleButton>
                    <ToggleButton value="center">
                      <FormatAlignCenter />
                    </ToggleButton>
                    <ToggleButton value="right">
                      <FormatAlignRight />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                
                {/* Shape Color */}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Shape Color
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {drawingColors.map((color) => (
                      <IconButton
                        key={color.value}
                        onClick={() => updateSelectedShape({ fillColor: color.value, strokeColor: color.value })}
                        size="small"
                        title={color.name}
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: color.value,
                          border: fillColor === color.value ? 2 : 1,
                          borderColor: fillColor === color.value ? 'primary.main' : 'divider',
                          '&:hover': { bgcolor: color.value, opacity: 0.8 },
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
                
                {/* Stroke Width */}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Stroke Width: {strokeWidth}px
                  </Typography>
                  <Slider
                    value={strokeWidth}
                    onChange={(_, v) => updateSelectedShape({ strokeWidth: v as number })}
                    min={1}
                    max={8}
                    step={1}
                    size="small"
                  />
                </Box>
                
                {/* Opacity */}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Opacity: {Math.round(opacity * 100)}%
                  </Typography>
                  <Slider
                    value={opacity}
                    onChange={(_, v) => updateSelectedShape({ opacity: v as number })}
                    min={0.2}
                    max={1}
                    step={0.05}
                    size="small"
                  />
                </Box>
                
                {/* Dimensions (not for lines/arrows) */}
                {selectedShape.type !== 'line' && selectedShape.type !== 'arrow' && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Width"
                      type="number"
                      value={width}
                      onChange={(e) => updateSelectedShape({ width: Math.max(20, Number(e.target.value)) })}
                      size="small"
                      sx={{ flex: 1 }}
                      inputProps={{ min: 20 }}
                    />
                    <TextField
                      label="Height"
                      type="number"
                      value={height}
                      onChange={(e) => updateSelectedShape({ height: Math.max(20, Number(e.target.value)) })}
                      size="small"
                      sx={{ flex: 1 }}
                      inputProps={{ min: 20 }}
                    />
                  </Stack>
                )}
                
                {/* Layer Controls */}
                <Box>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Layer Order
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => bringToFront(selectedShape.id)}
                      title="Bring to Front"
                    >
                      <VerticalAlignTop fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => bringForward(selectedShape.id)}
                      title="Bring Forward"
                    >
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => sendBackward(selectedShape.id)}
                      title="Send Backward"
                    >
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => sendToBack(selectedShape.id)}
                      title="Send to Back"
                    >
                      <VerticalAlignBottom fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
                
                {/* Duplicate & Delete */}
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopy />}
                    onClick={() => duplicateShape(selectedShape.id)}
                    sx={{ flex: 1 }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Delete />}
                    onClick={() => deleteShape(selectedShape.id)}
                    sx={{ flex: 1 }}
                  >
                    Delete
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Alert severity="info" variant="outlined">
              Select a shape on the canvas to edit its properties, or click &quot;Add&quot; above to create a new shape.
            </Alert>
          )}
          
          <Divider />
          
          {/* Shape List */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2">
                Shapes ({shapes.length})
              </Typography>
              {shapes.length > 0 && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<ClearAll />}
                  onClick={clearAllShapes}
                >
                  Clear All
                </Button>
              )}
            </Stack>
            
            {sortedShapes.length > 0 ? (
              <List dense disablePadding>
                {sortedShapes.map((shape, index) => (
                  <ListItem key={shape.id} disablePadding>
                    <ListItemButton
                      selected={shape.id === selectedShapeId}
                      onClick={() => selectShape(shape.id)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            bgcolor: shape.fillColor || '#9C27B0',
                            borderRadius: shape.type === 'ellipse' ? '50%' : 0.5,
                            border: 1,
                            borderColor: 'divider',
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          shape.text
                            ? shape.text.substring(0, 20) + (shape.text.length > 20 ? '...' : '')
                            : `${shape.type} ${index + 1}`
                        }
                        secondary={`Layer ${shape.zIndex}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                No shapes yet. Click &quot;Add&quot; to create one.
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}