"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from "@mui/material";

interface CreateEventFormData {
  name: string;
  description: string;
  date: string;
}

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateEventFormData) => void;
}

const getInitialFormData = (): CreateEventFormData => ({
  name: "",
  description: "",
  date: new Date().toISOString().split('T')[0]
});

export function CreateEventDialog({ open, onClose, onCreate }: CreateEventDialogProps) {
  const [formData, setFormData] = useState<CreateEventFormData>(getInitialFormData);

  const handleCreate = () => {
    onCreate(formData);
    setFormData(getInitialFormData());
  };

  const handleClose = () => {
    onClose();
    setFormData(getInitialFormData());
  };

  const isValid = formData.name.trim().length > 0;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      fullWidth 
      maxWidth="sm" 
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Event</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus 
          margin="dense" 
          label="Event Name" 
          fullWidth 
          variant="outlined"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          sx={{ mt: 1 }}
        />
        <TextField
          margin="dense" 
          label="Start Date" 
          type="date" 
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        />
        <TextField
          margin="dense" 
          label="Description" 
          fullWidth 
          multiline 
          rows={4}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe your event details..."
        />
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleCreate} 
          variant="contained" 
          sx={{ px: 4 }}
          disabled={!isValid}
        >
          Create Event
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export type { CreateEventFormData };