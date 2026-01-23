"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Typography,
  Box
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { Event } from "@/types/Event";
import { getEventSummary } from "@/utils/eventImportUtils";

interface ExportEventDialogProps {
  open: boolean;
  event: Event | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExportEventDialog({
  open,
  event,
  onConfirm,
  onCancel
}: ExportEventDialogProps) {
  if (!event) return null;

  const summary = getEventSummary(event);

  return (
    <Dialog 
      open={open} 
      onClose={onCancel} 
      fullWidth 
      maxWidth="sm" 
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>Export Event</DialogTitle>
      <DialogContent>
        <Box>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Are you sure you want to export <strong>{event.name}</strong>?
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The exported JSON file will contain all event data including:
          </Typography>
          
          <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ✓ Event details and settings
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ✓ All days and sessions ({summary.daysCount} days, {summary.sessionsCount} sessions)
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ✓ Master guest lists ({summary.hostGuestsCount} host, {summary.externalGuestsCount} external)
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ✓ Seat plans and table configurations
            </Typography>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              ✓ Tracking data and adjacency records
            </Typography>
          </Box>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            You can re-import this file later to restore the event on any device.
          </Alert>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          startIcon={<FileDownloadIcon />}
          sx={{ px: 4 }}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
}