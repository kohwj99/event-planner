"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore"; //
import { EventType } from "@/types/Event";
import { 
  Typography, Button, Paper, IconButton, 
  Dialog, DialogTitle, DialogContent, TextField, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Box, Chip
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function EventDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  // Store Access
  const event = useEventStore(state => state.events.find(e => e.id === id));
  const addDay = useEventStore(state => state.addDay);
  const addSession = useEventStore(state => state.addSession);

  // Local State for Session Creation
  const [sessionModal, setSessionModal] = useState({ open: false, dayId: "" });
  const [sessionForm, setSessionForm] = useState({
    name: "",
    description: "",
    type: "Executive meeting" as EventType,
    time: "09:00"
  });

  if (!event) return <div>Event not found</div>;

  /* --- 🧠 Logic: Add a new Day --- */
  const handleAddDay = () => {
    let nextDate = new Date();
    if (event.days.length > 0) {
      const lastDay = event.days[event.days.length - 1];
      const d = new Date(lastDay.date);
      d.setDate(d.getDate() + 1);
      nextDate = d;
    }
    addDay(event.id, nextDate.toISOString());
  };

  /* --- 🧠 Logic: Create Session --- */
  const handleCreateSession = () => {
    if (!sessionModal.dayId) return;
    
    const dayObj = event.days.find(d => d.id === sessionModal.dayId);
    if (!dayObj) return;

    // Create ISO string for start time
    const dateStr = dayObj.date.split('T')[0]; 
    const isoStart = `${dateStr}T${sessionForm.time}:00.000Z`; 

    // 🔴 FIX: Pass the full object, not just the string
    addSession(event.id, sessionModal.dayId, {
      name: sessionForm.name,
      description: sessionForm.description,
      sessionType: sessionForm.type,
      startTime: isoStart
    });

    setSessionModal({ open: false, dayId: "" });
    setSessionForm({ name: "", description: "", type: "Executive meeting", time: "09:00" });
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      
      {/* --- HEADER --- */}
      <Paper elevation={2} sx={{ p: 2, zIndex: 10 }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <IconButton onClick={() => router.push("/")}><ArrowBackIcon /></IconButton>
            <div>
              <Typography variant="h5" fontWeight="bold">{event.name}</Typography>
              <Typography variant="body2" color="text.secondary">{event.description}</Typography>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outlined" startIcon={<UploadFileIcon />}>
              Upload Guest List
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddDay}>
              Add Day
            </Button>
          </div>
        </div>
        
        <div className="mt-2 flex gap-4 text-sm text-gray-600">
           <span>Host Guests: {event.masterHostGuests.length}</span>
           <span>|</span>
           <span>External Guests: {event.masterExternalGuests.length}</span>
        </div>
      </Paper>

      {/* --- MAIN CONTENT: HORIZONTAL SCROLLING DAYS --- */}
      <Box sx={{ flexGrow: 1, overflowX: "auto", p: 3, backgroundColor: "#f5f5f5" }}>
        <div className="flex gap-6 h-full">
          
          {event.days.map((day, index) => (
            <Paper 
              key={day.id} 
              elevation={3}
              sx={{ 
                width: 350, 
                minWidth: 350, 
                display: "flex", 
                flexDirection: "column",
                height: "100%",
                borderRadius: 2,
                backgroundColor: "#fff"
              }}
            >
              {/* Day Header */}
              <Box sx={{ p: 2, borderBottom: "1px solid #eee", backgroundColor: "#fafafa" }}>
                <Typography variant="subtitle1" fontWeight="bold" color="primary">
                  Day {index + 1}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(day.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric'})}
                </Typography>
              </Box>

              {/* Sessions List */}
              <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                {[...day.sessions]
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((session) => (
                  <Paper 
                    key={session.id}
                    elevation={1}
                    onClick={() => router.push(`/session/${session.id}`)}
                    sx={{ 
                      p: 2, 
                      cursor: "pointer", 
                      borderLeft: "4px solid #1976d2",
                      "&:hover": { backgroundColor: "#f0f7ff" }
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                       <Chip 
                          label={session.sessionType} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                          sx={{ fontSize: '0.7rem', height: 20 }}
                       />
                    </div>
                    
                    <Typography variant="h6" fontSize="1rem" fontWeight="bold">
                      {session.name}
                    </Typography>
                    
                    <div className="flex items-center gap-1 mt-1 text-gray-500">
                      <AccessTimeIcon fontSize="small" sx={{ fontSize: 16 }} />
                      <Typography variant="caption">
                        {new Date(session.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </Typography>
                    </div>
                  </Paper>
                ))}

                {day.sessions.length === 0 && (
                   <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
                     No sessions planned.
                   </Typography>
                )}
              </Box>

              <Box sx={{ p: 2, borderTop: "1px solid #eee" }}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<AddIcon />}
                  onClick={() => setSessionModal({ open: true, dayId: day.id })}
                >
                  New Session
                </Button>
              </Box>
            </Paper>
          ))}

          {event.days.length === 0 && (
            <div className="flex items-center justify-center w-full text-gray-400">
              <Typography>Click "Add Day" to begin planning.</Typography>
            </div>
          )}

        </div>
      </Box>

      {/* --- SESSION CREATION MODAL --- */}
      <Dialog open={sessionModal.open} onClose={() => setSessionModal({ ...sessionModal, open: false })}>
        <DialogTitle>Create Session</DialogTitle>
        <DialogContent sx={{ width: 400 }}>
          <TextField
            autoFocus margin="dense" label="Session Name" fullWidth
            value={sessionForm.name}
            onChange={(e) => setSessionForm({...sessionForm, name: e.target.value})}
          />
          
          <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={sessionForm.type}
              label="Type"
              onChange={(e) => setSessionForm({ ...sessionForm, type: e.target.value as EventType })}
            >
              <MenuItem value="Executive meeting">Executive Meeting</MenuItem>
              <MenuItem value="Bilateral Meeting">Bilateral Meeting</MenuItem>
              <MenuItem value="Meal">Meal</MenuItem>
              <MenuItem value="Phototaking">Phototaking</MenuItem>
            </Select>
          </FormControl>

          <TextField
            margin="dense" label="Start Time" type="time" fullWidth
            InputLabelProps={{ shrink: true }}
            value={sessionForm.time}
            onChange={(e) => setSessionForm({...sessionForm, time: e.target.value})}
            sx={{ mt: 2 }}
          />

          <TextField
            margin="dense" label="Description" fullWidth multiline rows={2}
            value={sessionForm.description}
            onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionModal({ ...sessionModal, open: false })}>Cancel</Button>
          <Button onClick={handleCreateSession} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}