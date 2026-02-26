import { DialogContentText } from '@mui/material';
import ConfirmDialog from './ConfirmDialog';

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({
  open,
  title,
  message,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      confirmLabel="Delete"
      confirmColor="error"
    >
      <DialogContentText>{message}</DialogContentText>
    </ConfirmDialog>
  );
}
