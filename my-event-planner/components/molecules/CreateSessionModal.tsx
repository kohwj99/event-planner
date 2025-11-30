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
  MenuItem,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
} from "@mui/material";
import { Visibility } from "@mui/icons-material";
import { EventType } from "@/types/Event";

interface SessionFormData {
  name: string;
  description: string;
  type: EventType;
  time: string;
  tracked: boolean;
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

        {/* Boss Adjacency Tracking Toggle */}
        <Box 
          sx={{ 
            mt: 3, 
            p: 2, 
            bgcolor: sessionForm.tracked ? '#f0f7ff' : '#f5f5f5', 
            borderRadius: 1,
            border: sessionForm.tracked ? '1px solid #1976d2' : '1px solid #e0e0e0',
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={sessionForm.tracked}
                onChange={(e) => onChange({ ...sessionForm, tracked: e.target.checked })}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Visibility fontSize="small" />
                <Typography variant="body2" fontWeight={500}>
                  Track Boss Adjacency
                </Typography>
              </Box>
            }
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, ml: 4 }}>
            Enable to monitor and analyze seating adjacency patterns with tracked guests
          </Typography>
        </Box>

        {sessionForm.tracked && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This session will be included in Boss Adjacency analysis. Make sure to mark relevant guests as tracked in the Master Guest List.
          </Alert>
        )}
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