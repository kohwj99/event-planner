// components/molecules/GuestReassignConfirmModal.tsx
'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Alert,
  Chip,
  Box,
} from '@mui/material';
import { Warning } from '@mui/icons-material';

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Warning color="warning" />
          <Typography variant="h6">Guest Already Seated</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
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
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" onClick={onConfirm}>
          Confirm Move
        </Button>
      </DialogActions>
    </Dialog>
  );
}