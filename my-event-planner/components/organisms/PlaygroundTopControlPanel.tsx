// components/organisms/PlaygroundTopControlPanel.tsx
// Top control panel for the playground canvas
// UPDATED: Added Plan/Draw mode toggle for drawing layer feature

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
  TableChart,
  Draw,
} from '@mui/icons-material';
import AutoFillButton from '@/components/atoms/AutoFillButton';

// ============================================================================
// TYPES
// ============================================================================

export type CanvasMode = 'plan' | 'draw';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface PlaygroundTopControlPanelProps {
  sessionName: string;
  sessionType: string;
  formattedDate: string;
  hasNoGuests: boolean;
  isLocked?: boolean;
  canvasMode?: CanvasMode;
  onBack: () => void;
  onSave: () => void;
  onReset: () => void;
  onManageGuests: () => void;
  onExport: () => void;
  onToggleLock?: () => void;
  onCanvasModeChange?: (mode: CanvasMode) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PlaygroundTopControlPanel({
  sessionName,
  sessionType,
  formattedDate,
  hasNoGuests,
  isLocked = false,
  canvasMode = 'plan',
  onBack,
  onSave,
  onReset,
  onManageGuests,
  onExport,
  onToggleLock,
  onCanvasModeChange,
}: PlaygroundTopControlPanelProps) {
  
  const handleModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: CanvasMode | null
  ) => {
    if (newMode && onCanvasModeChange) {
      onCanvasModeChange(newMode);
    }
  };
  
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
              {/* Lock indicator chip */}
              {isLocked && (
                <Chip
                  icon={<Lock sx={{ fontSize: 16 }} />}
                  label="Locked"
                  size="small"
                  color="warning"
                  variant="filled"
                />
              )}
              {/* Drawing mode indicator */}
              {canvasMode === 'draw' && (
                <Chip
                  icon={<Draw sx={{ fontSize: 16 }} />}
                  label="Drawing Mode"
                  size="small"
                  color="secondary"
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

        {/* CENTER - Mode Toggle */}
        {onCanvasModeChange && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ToggleButtonGroup
              value={canvasMode}
              exclusive
              onChange={handleModeChange}
              size="small"
              color="primary"
            >
              <ToggleButton value="plan" sx={{ px: 2 }}>
                <TableChart sx={{ mr: 1, fontSize: 20 }} />
                Plan
              </ToggleButton>
              <ToggleButton value="draw" sx={{ px: 2 }}>
                <Draw sx={{ mr: 1, fontSize: 20 }} />
                Draw
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* RIGHT */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Divider orientation="vertical" flexItem />

          {/* Lock/Unlock Button */}
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

          <Divider orientation="vertical" flexItem />

          {/* Plan mode controls - hidden in draw mode */}
          {canvasMode === 'plan' && (
            <>
              <Tooltip title={isLocked ? 'Session is locked' : ''}>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<Groups />}
                    onClick={onManageGuests}
                    disabled={isLocked}
                  >
                    Manage Guests
                  </Button>
                </span>
              </Tooltip>

              <AutoFillButton disabled={isLocked} />

              <Tooltip title={isLocked ? 'Session is locked' : ''}>
                <span>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<RestartAlt />}
                    onClick={onReset}
                    disabled={isLocked}
                  >
                    Reset
                  </Button>
                </span>
              </Tooltip>

              <Divider orientation="vertical" flexItem />
            </>
          )}

          {/* Always visible buttons */}
          <Button
            variant="contained"
            color="secondary"
            startIcon={<FileDownload />}
            onClick={onExport}
          >
            Export
          </Button>

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
      <Stack spacing={1} sx={{ mt: (hasNoGuests && canvasMode === 'plan') || isLocked || canvasMode === 'draw' ? 2 : 0 }}>
        {/* Lock info alert */}
        {isLocked && (
          <Alert severity="info" icon={<Info />}>
            This session is locked. Click "Unlock" to enable editing.
          </Alert>
        )}
        
        {/* Draw mode info alert */}
        {canvasMode === 'draw' && !isLocked && (
          <Alert severity="info" icon={<Draw />}>
            Drawing mode is active. Seat planning is disabled. Switch to "Plan" mode to manage seats.
          </Alert>
        )}
        
        {hasNoGuests && !isLocked && canvasMode === 'plan' && (
          <Alert severity="warning" icon={<Warning />}>
            No attendees assigned. Click "Manage Guests" then "Manage Attendees" to select guests.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}