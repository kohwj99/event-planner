"use client";

import { useEffect, useState } from "react";
import { useEventStore } from "@/store/eventStore";
import {
  Container, Typography, Button, Card, CardContent, CardActionArea,
  CardActions, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Box, Divider
} from "@mui/material";

import Grid from "@mui/material/Grid";
import { useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

export default function HomePage() {
  const router = useRouter();
  const { events, createEvent, deleteEvent, setActiveEvent, _hasHydrated } = useEventStore();

  const [isMounted, setIsMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isReady = isMounted && _hasHydrated;

  const handleCreate = () => {
    createEvent(
      formData.name,
      formData.description,
      "Executive meeting",
      formData.date
    );
    setOpen(false);
    setFormData({
      name: "",
      description: "",
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleNavigate = (id: string) => {
    setActiveEvent(id);
    router.push(`/events/${id}`);
  };

  return (
    // Set background to a very light grey/white for the whole page
    <Box sx={{ bgcolor: "#f8f9fa", minHeight: "100vh", py: 6 }}>
      <Container maxWidth="lg">
        {!isReady ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 2 }}>
            <CircularProgress size={48} />
            <Typography variant="body1" color="text.secondary">Loading events...</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
              <Box>
                <Typography variant="h4" fontWeight="800" color="text.primary" gutterBottom>
                  C-SIT
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Manage and track your upcoming events.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                size="large"
                onClick={() => setOpen(true)}
                sx={{ borderRadius: 2, textTransform: 'none', px: 4, boxShadow: 2 }}
              >
                New Event
              </Button>
            </Box>

            <Grid container spacing={3}>
              {events.map((event) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id}>
                  <Card 
                    elevation={0} 
                    sx={{ 
                      height: "100%", 
                      display: 'flex', 
                      flexDirection: 'column',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: '0.3s',
                      '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }
                    }}
                  >
                    <CardActionArea onClick={() => handleNavigate(event.id)} sx={{ flexGrow: 1, p: 1 }}>
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
                          {event.name}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary' }}>
                          <CalendarTodayIcon sx={{ fontSize: 16 }} />
                          <Typography variant="caption" fontWeight="500">
                            {(event.startDate || event.createdAt).split('T')[0]}
                          </Typography>
                        </Box>

                        <Divider sx={{ mb: 2 }} />

                        {/* Neat & Professional Description handling */}
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ 
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap', // Preserves spacing but wraps naturally
                            overflowWrap: 'break-word' 
                          }}
                        >
                          {event.description || "No description provided."}
                        </Typography>

                        {event.trackingEnabled && (
                          <Box sx={{ mt: 2, p: 1, bgcolor: 'aliceblue', borderRadius: 1 }}>
                            <Typography variant="caption" color="primary" fontWeight="600">
                              📊 Tracking {event.trackedGuestIds?.length || 0} guests
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </CardActionArea>
                    <CardActions sx={{ justifyContent: "flex-end", p: 2, pt: 0 }}>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => deleteEvent(event.id)}
                        sx={{ textTransform: 'none' }}
                      >
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {events.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 10, bgcolor: 'white', borderRadius: 4, border: '1px dashed grey' }}>
                <Typography variant="h5" color="text.secondary" gutterBottom>No events found</Typography>
                <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => setOpen(true)}>
                  Create your first event
                </Button>
              </Box>
            )}

            {/* Create Event Dialog */}
            <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
              <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Event</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus margin="dense" label="Event Name" fullWidth variant="outlined"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  sx={{ mt: 1 }}
                />
                <TextField
                  margin="dense" label="Start Date" type="date" fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
                <TextField
                  margin="dense" label="Description" fullWidth multiline rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your event details..."
                />
              </DialogContent>
              <DialogActions sx={{ p: 3 }}>
                <Button onClick={() => setOpen(false)} color="inherit">Cancel</Button>
                <Button onClick={handleCreate} variant="contained" sx={{ px: 4 }}>Create Event</Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Container>
    </Box>
  );
}