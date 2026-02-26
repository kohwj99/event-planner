import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  submitLabel: string;
  submitDisabled?: boolean;
  submitIcon?: React.ReactNode;
  hideSubmit?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md';
  children: React.ReactNode;
}

export default function FormDialog({
  open,
  onClose,
  onSubmit,
  title,
  submitLabel,
  submitDisabled = false,
  submitIcon,
  hideSubmit = false,
  maxWidth = 'sm',
  children,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        {!hideSubmit && (
          <Button
            onClick={onSubmit}
            variant="contained"
            sx={{ px: 4 }}
            disabled={submitDisabled}
            startIcon={submitIcon}
          >
            {submitLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export type { FormDialogProps };
