"use client";

import { useEffect, useState } from "react";
import { useEventStore } from "@/store/eventStore";
import {
  Container, Typography, Button, Card, CardContent, CardActionArea,
  CardActions, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Box
} from "@mui/material";

import Grid from "@mui/material/Grid";

import { useRouter } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

export default function HomePage() {
  const router = useRouter();
  const { events, createEvent, deleteEvent, setActiveEvent, _hasHydrated } = useEventStore();

  // Track if component has mounted (for SSR safety)
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Combined hydration check
  const isReady = isMounted && _hasHydrated;

  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: new Date().toISOString().split('T')[0] // Default today
  });

  // Log hydration status for debugging
  useEffect(() => {
    if (isReady) {
      console.log('✅ App hydrated - events loaded:', events.length);
    }
  }, [isReady, events.length]);

  const handleCreate = () => {
    createEvent(
      formData.name,
      formData.description,
      "Executive meeting", // Default type
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

  // Show loading state until hydration is complete
  // Use consistent container structure to prevent hydration mismatch
  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      {!isReady ? (
        // Loading state
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '50vh',
            gap: 2
          }}
        >
          <CircularProgress size={48} />
          <Typography variant="body1" color="text.secondary">
            Loading events...
          </Typography>
        </Box>
      ) : (
        // Main content
        <>
          <div className="flex justify-between items-center mb-8">
            <Typography variant="h3" fontWeight="bold" color="primary">
              Event Dashboard
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="large"
              onClick={() => setOpen(true)}
            >
              New Event
            </Button>
          </div>

          <Grid container spacing={3}>
            {events.map((event) => (
              <Grid size={{ xs: 12, md: 4, lg: 3 }} key={event.id}>
                <Card elevation={4} sx={{ height: "100%", display: 'flex', flexDirection: 'column' }}>
                  <CardActionArea onClick={() => handleNavigate(event.id)} sx={{ flexGrow: 1 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {event.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Date: {(event.startDate || event.createdAt).split('T')[0]}
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {event.description}
                      </Typography>
                      {/* Show tracking status if enabled */}
                      {event.trackingEnabled && (
                        <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                          📊 Tracking: {event.trackedGuestIds?.length || 0} guests
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                  <CardActions sx={{ justifyContent: "flex-end" }}>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => deleteEvent(event.id)}
                    >
                      Delete
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Empty state */}
          {events.length === 0 && (
            <Box 
              sx={{ 
                textAlign: 'center', 
                py: 8,
                color: 'text.secondary'
              }}
            >
              <Typography variant="h5" gutterBottom>
                No events yet
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Create your first event to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpen(true)}
              >
                Create Event
              </Button>
            </Box>
          )}

          {/* Create Event Dialog */}
          <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Create New Event</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus margin="dense" label="Event Name" fullWidth
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                margin="dense" label="Start Date" type="date" fullWidth
                InputLabelProps={{ shrink: true }}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
              <TextField
                margin="dense" label="Description" fullWidth multiline rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} variant="contained">Create</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
}