'use client';

import {
  Paper,
  Stack,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  Divider,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Groups,
  Warning,
  FileDownload,
  RestartAlt,
  Lock,
  LockOpen,
  Info,
  GridView,
  EventSeat,
  Draw,
} from '@mui/icons-material';
import AutoFillButton from '@/components/features/session/AutoFillButton';
import { CanvasLayer } from '@/store/drawUIStore';

interface PlaygroundTopControlPanelProps {
  sessionName: string;
  sessionType: string;
  formattedDate: string;
  hasNoGuests: boolean;
  isLocked?: boolean;
  activeLayer?: CanvasLayer;
  onBack: () => void;
  onSave: () => void;
  onReset: () => void;
  onManageGuests: () => void;
  onExport: () => void;
  onToggleLock?: () => void;
  onChunkLayout?: () => void;
  onLayerChange?: (layer: CanvasLayer) => void;
}

export default function PlaygroundTopControlPanel({
  sessionName,
  sessionType,
  formattedDate,
  hasNoGuests,
  isLocked = false,
  activeLayer = 'plan',
  onBack,
  onSave,
  onReset,
  onManageGuests,
  onExport,
  onToggleLock,
  onChunkLayout,
  onLayerChange,
}: PlaygroundTopControlPanelProps) {
  const isDrawMode = activeLayer === 'draw';
  return (
    <Paper elevation={2} sx={{ p: 2, zIndex: 10 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {/* LEFT */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={onBack}>
            <ArrowBack />
          </IconButton>

          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight="bold">
                {sessionName}
              </Typography>
              {/* 🆕 Lock indicator chip */}
              {isLocked && (
                <Chip
                  icon={<Lock sx={{ fontSize: 16 }} />}
                  label="Locked"
                  size="small"
                  color="warning"
                  variant="filled"
                />
              )}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Chip
                label={sessionType}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                {formattedDate}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        {/* CENTER - Layer Toggle */}
        {onLayerChange && (
          <ToggleButtonGroup
            value={activeLayer}
            exclusive
            onChange={(_, val) => val && onLayerChange(val as CanvasLayer)}
            size="small"
          >
            <ToggleButton value="plan">
              <EventSeat sx={{ mr: 0.5, fontSize: 18 }} />
              Plan
            </ToggleButton>
            <ToggleButton value="draw">
              <Draw sx={{ mr: 0.5, fontSize: 18 }} />
              Draw
            </ToggleButton>
          </ToggleButtonGroup>
        )}

        {/* RIGHT */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Divider orientation="vertical" flexItem />

          {/* 🆕 Lock/Unlock Button */}
          {onToggleLock && (
            <Tooltip 
              title={isLocked ? 'Unlock session to enable editing' : 'Lock session to prevent changes'}
            >
              <Button
                variant={isLocked ? 'contained' : 'outlined'}
                color={isLocked ? 'warning' : 'inherit'}
                startIcon={isLocked ? <LockOpen /> : <Lock />}
                onClick={onToggleLock}
              >
                {isLocked ? 'Unlock' : 'Lock'}
              </Button>
            </Tooltip>
          )}

          {onChunkLayout && (
            <Tooltip title={isLocked ? 'Session is locked' : isDrawMode ? 'Switch to Plan layer' : 'Arrange tables into chunk grid'}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={<GridView />}
                  onClick={onChunkLayout}
                  disabled={isLocked || isDrawMode}
                >
                  Layout
                </Button>
              </span>
            </Tooltip>
          )}

          <Divider orientation="vertical" flexItem />

          <Tooltip title={isLocked ? 'Session is locked' : isDrawMode ? 'Switch to Plan layer' : ''}>
            <span>
              <Button
                variant="contained"
                startIcon={<Groups />}
                onClick={onManageGuests}
                disabled={isLocked || isDrawMode}
              >
                Manage Guests
              </Button>
            </span>
          </Tooltip>

          <AutoFillButton disabled={isLocked || isDrawMode} />

          <Button
            variant="contained"
            color="secondary"
            startIcon={<FileDownload />}
            onClick={onExport}
          >
            Export
          </Button>

          <Tooltip title={isLocked ? 'Session is locked' : isDrawMode ? 'Switch to Plan layer' : ''}>
            <span>
              <Button
                variant="contained"
                color="error"
                startIcon={<RestartAlt />}
                onClick={onReset}
                disabled={isLocked || isDrawMode}
              >
                Reset
              </Button>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          <Button
            variant="contained"
            color="success"
            startIcon={<Save />}
            size="large"
            onClick={onSave}
          >
            Save
          </Button>
        </Stack>
      </Stack>

      {/* Alerts */}
      <Stack spacing={1} sx={{ mt: hasNoGuests || isLocked ? 2 : 0 }}>
        {/* 🆕 Lock info alert */}
        {isLocked && (
          <Alert severity="info" icon={<Info />}>
            This session is locked. Click "Unlock" to enable editing.
          </Alert>
        )}
        
        {hasNoGuests && !isLocked && (
          <Alert severity="warning" icon={<Warning />}>
            No attendees assigned. Click "Manage Guests" → "Manage Attendees" to select guests.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}