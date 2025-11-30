"use client";

import { useState, useEffect } from "react";
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
import { useHydrationContext } from "@/components/providers/StoreHydrationProvider";

export default function HomePage() {
  const router = useRouter();
  const { events, createEvent, deleteEvent, setActiveEvent } = useEventStore();
  const { isHydrated } = useHydrationContext();
  
  // Track if component has mounted to prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: new Date().toISOString().split('T')[0] // Default today
  });

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

  // Show loading state while mounting or hydrating
  // Use isMounted to ensure consistent server/client render
  const showLoading = !isMounted || !isHydrated;

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      {showLoading ? (
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          minHeight="50vh"
          flexDirection="column"
          gap={2}
        >
          <CircularProgress />
          <Typography color="text.secondary">Loading events...</Typography>
        </Box>
      ) : (
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
        </>
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
    </Container>
  );
}