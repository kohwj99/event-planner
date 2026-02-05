"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Typography,
  Box,
  Divider
} from "@mui/material";
import { Event } from "@/types/Event";
import { getEventSummary } from "@/utils/eventImportUtils";

interface ImportEventDialogProps {
  open: boolean;
  importedEvent: Event | null;
  importName: string;
  error: string | null;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportEventDialog({
  open,
  importedEvent,
  importName,
  error,
  onNameChange,
  onConfirm,
  onCancel
}: ImportEventDialogProps) {
  const summary = importedEvent ? getEventSummary(importedEvent) : null;
  const isValid = importName.trim().length > 0;

  return (
    <Dialog 
      open={open} 
      onClose={onCancel} 
      fullWidth 
      maxWidth="sm" 
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>Import Event</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : importedEvent && summary ? (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              A new event ID will be generated to prevent conflicts with existing events.
            </Alert>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please provide a name for the imported event:
            </Typography>
            
            <TextField
              autoFocus
              margin="dense"
              label="Event Name"
              fullWidth
              variant="outlined"
              value={importName}
              onChange={(e) => onNameChange(e.target.value)}
              sx={{ mb: 3 }}
            />
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Import Summary:
            </Typography>
            <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>Original Name:</strong> {summary.originalName}
              </Typography>
              <Typography variant="body2">
                <strong>Days:</strong> {summary.daysCount}
              </Typography>
              <Typography variant="body2">
                <strong>Total Sessions:</strong> {summary.sessionsCount}
              </Typography>
              <Typography variant="body2">
                <strong>Host Guests:</strong> {summary.hostGuestsCount}
              </Typography>
              <Typography variant="body2">
                <strong>External Guests:</strong> {summary.externalGuestsCount}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Processing file...
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        {importedEvent && !error && (
          <Button 
            onClick={onConfirm} 
            variant="contained" 
            sx={{ px: 4 }}
            disabled={!isValid}
          >
            Import Event
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}