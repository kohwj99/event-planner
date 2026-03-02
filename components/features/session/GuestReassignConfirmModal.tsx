// components/features/session/GuestReassignConfirmModal.tsx
'use client';

import {
  Typography,
  Stack,
  Alert,
  Chip,
  Box,
} from '@mui/material';
import ConfirmDialog from '@/components/shared/molecules/ConfirmDialog';

interface GuestReassignConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  guestName: string;
  currentTable: string;
  currentSeat: number;
  newTable: string;
  newSeat: number;
}

export default function GuestReassignConfirmModal({
  open,
  onClose,
  onConfirm,
  guestName,
  currentTable,
  currentSeat,
  newTable,
  newSeat,
}: GuestReassignConfirmModalProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Guest Already Seated"
      confirmLabel="Confirm Move"
    >
      <Stack spacing={2}>
        <Alert severity="warning">
          <Typography variant="body2" fontWeight="bold">
            {guestName} is already seated and will be moved.
          </Typography>
        </Alert>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Current Location:
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={currentTable} color="primary" size="small" />
            <Chip label={`Seat ${currentSeat}`} variant="outlined" size="small" />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            New Location:
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip label={newTable} color="success" size="small" />
            <Chip label={`Seat ${newSeat}`} variant="outlined" size="small" />
          </Stack>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Do you want to proceed with moving this guest?
        </Typography>
      </Stack>
    </ConfirmDialog>
  );
}
