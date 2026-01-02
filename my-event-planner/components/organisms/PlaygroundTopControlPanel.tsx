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
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Groups,
  Warning,
  FileDownload,
  RestartAlt,
} from '@mui/icons-material';
import AutoFillButton from '@/components/atoms/AutoFillButton';

interface PlaygroundTopControlPanelProps {
  sessionName: string;
  sessionType: string;
  formattedDate: string;
  hasNoGuests: boolean;
  onBack: () => void;
  onSave: () => void;
  onReset: () => void;
  onManageGuests: () => void;
  onExport: () => void;
}

export default function PlaygroundTopControlPanel({
  sessionName,
  sessionType,
  formattedDate,
  hasNoGuests,
  onBack,
  onSave,
  onReset,
  onManageGuests,
  onExport,
}: PlaygroundTopControlPanelProps) {
  return (
    <Paper elevation={2} sx={{ p: 2, zIndex: 10 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {/* LEFT */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={onBack}>
            <ArrowBack />
          </IconButton>

          <Box>
            <Typography variant="h5" fontWeight="bold">
              {sessionName}
            </Typography>
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

        {/* RIGHT */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Divider orientation="vertical" flexItem />

          <Button
            variant="contained"
            startIcon={<Groups />}
            onClick={onManageGuests}
          >
            Manage Guests
          </Button>

          <AutoFillButton />

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
            color="error"
            startIcon={<RestartAlt />}
            onClick={onReset}
          >
            Reset
          </Button>

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

      {hasNoGuests && (
        <Alert severity="warning" sx={{ mt: 2 }} icon={<Warning />}>
          No attendees assigned to this session. Click "Manage Guests" →
          "Manage Attendees" tab to select guests from the master list.
        </Alert>
      )}
    </Paper>
  );
}