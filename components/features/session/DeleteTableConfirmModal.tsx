// components/features/session/DeleteTableConfirmModal.tsx
// Simple confirmation modal for deleting a table

'use client';

import {
  Typography,
  Stack,
  Alert,
} from '@mui/material';
import { Warning, DeleteForever } from '@mui/icons-material';
import { Table } from '@/types/Table';
import ConfirmDialog from '@/components/shared/molecules/ConfirmDialog';

interface DeleteTableConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  table: Table | null;
}

export default function DeleteTableConfirmModal({
  open,
  onClose,
  onConfirm,
  table,
}: DeleteTableConfirmModalProps) {
  if (!table) return null;

  const seatedGuests = table.seats.filter((s) => s.assignedGuestId).length;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Table?"
      confirmLabel="Delete"
      confirmColor="error"
      confirmIcon={<DeleteForever />}
      maxWidth="xs"
    >
      <Stack spacing={2}>
        <Typography variant="body1">
          Are you sure you want to delete <strong>{table.label}</strong>?
        </Typography>

        {seatedGuests > 0 && (
          <Alert severity="warning" icon={<Warning />}>
            This table has <strong>{seatedGuests}</strong> seated guest{seatedGuests > 1 ? 's' : ''}.
            They will be unseated.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary">
          Tables after this one will be renumbered automatically.
        </Typography>

        <Typography variant="caption" color="text.secondary">
          This action cannot be undone.
        </Typography>
      </Stack>
    </ConfirmDialog>
  );
}
