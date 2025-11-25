import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import { EventType } from "@/types/Event";

interface SessionFormData {
  name: string;
  description: string;
  type: EventType;
  time: string;
}

interface CreateSessionModalProps {
  open: boolean;
  sessionForm: SessionFormData;
  onClose: () => void;
  onChange: (data: SessionFormData) => void;
  onCreate: () => void;
}

export default function CreateSessionModal({ 
  open, 
  sessionForm, 
  onClose, 
  onChange, 
  onCreate 
}: CreateSessionModalProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Session</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          autoFocus 
          margin="dense" 
          label="Session Name" 
          fullWidth
          value={sessionForm.name}
          onChange={(e) => onChange({...sessionForm, name: e.target.value})}
        />
        
        <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={sessionForm.type}
            label="Type"
            onChange={(e) => onChange({ ...sessionForm, type: e.target.value as EventType })}
          >
            <MenuItem value="Executive meeting">Executive Meeting</MenuItem>
            <MenuItem value="Bilateral Meeting">Bilateral Meeting</MenuItem>
            <MenuItem value="Meal">Meal</MenuItem>
            <MenuItem value="Phototaking">Phototaking</MenuItem>
          </Select>
        </FormControl>

        <TextField
          margin="dense" 
          label="Start Time" 
          type="time" 
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={sessionForm.time}
          onChange={(e) => onChange({...sessionForm, time: e.target.value})}
          sx={{ mt: 2 }}
        />

        <TextField
          margin="dense" 
          label="Description" 
          fullWidth 
          multiline 
          rows={2}
          value={sessionForm.description}
          onChange={(e) => onChange({...sessionForm, description: e.target.value})}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={onCreate} 
          variant="contained"
          disabled={!sessionForm.name.trim()}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}