"use client";

import { useEffect, useState, useRef, ChangeEvent } from "react";
import { useNavigation } from "@/components/providers/NavigationProvider";
import {
  Container,
  Typography,
  Button,
  Box,
  Snackbar,
  Alert
} from "@mui/material";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import FileUploadIcon from "@mui/icons-material/FileUpload";

import { useEventStore } from "@/store/eventStore";
import { Event } from "@/types/Event";
import { useSnackbar } from "@/hooks/useSnackbar";
import {
  parseEventJSON,
  createRemappedEvent,
  downloadEventAsJSON
} from "@/utils/eventImportUtils";
import { CreateEventDialog, CreateEventFormData } from "@/components/molecules/CreateEventDialog";
import { EmptyEventsState } from "@/components/molecules/EmptyEventState";
import { EventCard } from "@/components/organisms/EventCard";
import { ImportEventDialog } from "@/components/molecules/ImportEventDialog";
import PageLoader from "@/components/atoms/PageLoader";
import { ExportEventDialog } from "@/components/molecules/ExportEventDialog";


export default function HomePage() {
  const { navigateWithLoading } = useNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Store
  const { 
    events, 
    createEvent, 
    deleteEvent, 
    setActiveEvent, 
    _hasHydrated, 
    exportEventJSON, 
    importEventJSON 
  } = useEventStore();

  // Component state
  const [isMounted, setIsMounted] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedEventData, setImportedEventData] = useState<Event | null>(null);
  const [importEventName, setImportEventName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  
  // Export state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [eventToExport, setEventToExport] = useState<Event | null>(null);
  
  // Snackbar
  const { snackbar, showSuccess, showError, closeSnackbar } = useSnackbar();

  // Hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isReady = isMounted && _hasHydrated;

  // ==================== NAVIGATION ====================
  const handleNavigate = (id: string) => {
    setActiveEvent(id);
    navigateWithLoading(`/events/${id}`, 'Loading event...');
  };

  // ==================== CREATE EVENT ====================
  const handleCreate = (formData: CreateEventFormData) => {
    createEvent(
      formData.name,
      formData.description,
      "Executive meeting",
      formData.date
    );
    setCreateDialogOpen(false);
    showSuccess("Event created successfully!");
  };

  // ==================== IMPORT EVENT ====================
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setImportError("Please select a JSON file.");
      setImportDialogOpen(true);
      resetFileInput();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseEventJSON(content);

      if (result.success && result.event) {
        setImportedEventData(result.event);
        setImportEventName(result.event.name + " (Imported)");
        setImportError(null);
      } else {
        setImportError(result.error || "Unknown error occurred.");
      }
      setImportDialogOpen(true);
    };

    reader.onerror = () => {
      setImportError("Failed to read file.");
      setImportDialogOpen(true);
    };

    reader.readAsText(file);
    resetFileInput();
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportConfirm = () => {
    if (!importedEventData || !importEventName.trim()) return;

    const remappedEvent = createRemappedEvent(importedEventData, importEventName);
    const success = importEventJSON(JSON.stringify(remappedEvent));

    if (success) {
      showSuccess(`Event "${importEventName}" imported successfully!`);
      handleImportCancel();
    } else {
      setImportError("Failed to import event. Please try again.");
    }
  };

  const handleImportCancel = () => {
    setImportDialogOpen(false);
    setImportedEventData(null);
    setImportEventName("");
    setImportError(null);
  };

  // ==================== EXPORT EVENT ====================
  const handleExportClick = (event: Event) => {
    setEventToExport(event);
    setExportDialogOpen(true);
  };

  const handleExportConfirm = () => {
    if (!eventToExport) return;

    const jsonData = exportEventJSON(eventToExport.id);
    if (!jsonData) {
      showError("Failed to export event.");
      handleExportCancel();
      return;
    }

    downloadEventAsJSON(jsonData, eventToExport.name);
    showSuccess(`Event "${eventToExport.name}" exported successfully!`);
    handleExportCancel();
  };

  const handleExportCancel = () => {
    setExportDialogOpen(false);
    setEventToExport(null);
  };

  // ==================== RENDER ====================
  if (!isReady) {
    return <PageLoader message="Loading events..." />;
  }

  return (
    <Box sx={{ bgcolor: "#f8f9fa", minHeight: "100vh", py: 6 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight="800" color="text.primary" gutterBottom>
              C-SIT
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and track your upcoming events.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button
              variant="outlined"
              startIcon={<FileUploadIcon />}
              size="large"
              onClick={handleImportClick}
              sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
            >
              Import Event
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              size="large"
              onClick={() => setCreateDialogOpen(true)}
              sx={{ borderRadius: 2, textTransform: 'none', px: 4, boxShadow: 2 }}
            >
              New Event
            </Button>
          </Box>
        </Box>

        {/* Events Grid */}
        {events.length > 0 ? (
          <Grid container spacing={3}>
            {events.map((event) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id}>
                <EventCard
                  event={event}
                  onNavigate={handleNavigate}
                  onExport={handleExportClick}
                  onDelete={deleteEvent}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <EmptyEventsState
            onImport={handleImportClick}
            onCreate={() => setCreateDialogOpen(true)}
          />
        )}

        {/* Dialogs */}
        <CreateEventDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onCreate={handleCreate}
        />

        <ImportEventDialog
          open={importDialogOpen}
          importedEvent={importedEventData}
          importName={importEventName}
          error={importError}
          onNameChange={setImportEventName}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
        />

        <ExportEventDialog
          open={exportDialogOpen}
          event={eventToExport}
          onConfirm={handleExportConfirm}
          onCancel={handleExportCancel}
        />

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}