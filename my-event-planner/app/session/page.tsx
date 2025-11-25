'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEventStore } from '@/store/eventStore';
import { useGuestStore } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  Stack,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Groups,
  EventSeat,
  Warning,
} from '@mui/icons-material';
import PlayGroundCanvas from '@/components/organisms/PlaygroundCanvas';
import PlaygroundRightConfigPanel from '@/components/organisms/PlaygroundRightConfigPanel';
import PlaygroundTopControlPanel from '@/components/organisms/PlaygroundTopControlPanel';
import SessionGuestListModal from '@/components/molecules/SessionGuestListModal';

export default function SessionDetailPage() {
  const { id: sessionId } = useParams() as { id: string };
  const router = useRouter();

  // Event Store
  const getEventIdForSession = useEventStore((s) => s.getEventIdForSession);
  const getSessionGuests = useEventStore((s) => s.getSessionGuests);
  const setActiveSession = useEventStore((s) => s.setActiveSession);
  const saveSessionSeatPlan = useEventStore((s) => s.saveSessionSeatPlan);
  const loadSessionSeatPlan = useEventStore((s) => s.loadSessionSeatPlan);
  const events = useEventStore((s) => s.events);

  // Guest Store
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const resetGuests = useGuestStore((s) => s.resetGuests);
  const addGuest = useGuestStore((s) => s.addGuest);

  // Seat Store
  const tables = useSeatStore((s) => s.tables);
  const chunks = useSeatStore((s) => s.chunks);
  const resetTables = useSeatStore((s) => s.resetTables);
  const updateTableState = useSeatStore((s) => s.updateTableState);

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  // Find event and session data
  useEffect(() => {
    const foundEventId = getEventIdForSession(sessionId);
    if (foundEventId) {
      setEventId(foundEventId);
      setActiveSession(sessionId);

      // Find the session
      const event = events.find(e => e.id === foundEventId);
      if (event) {
        for (const day of event.days) {
          const foundSession = day.sessions.find(s => s.id === sessionId);
          if (foundSession) {
            setSession(foundSession);
            setDayId(day.id);
            break;
          }
        }
      }
    }
  }, [sessionId, events, getEventIdForSession, setActiveSession]);

  // Load session guests into guest store
  useEffect(() => {
    if (!sessionId) return;

    const sessionGuests = getSessionGuests(sessionId);
    if (sessionGuests) {
      // Clear existing guests
      resetGuests();

      // Load host guests
      sessionGuests.hostGuests.forEach(guest => {
        addGuest(guest);
      });

      // Load external guests
      sessionGuests.externalGuests.forEach(guest => {
        addGuest(guest);
      });
    }
  }, [sessionId, getSessionGuests, resetGuests, addGuest]);

  // Load existing seat plan
  useEffect(() => {
    if (!sessionId) return;

    const seatPlan = loadSessionSeatPlan(sessionId);
    if (seatPlan && seatPlan.tables.length > 0) {
      // Load tables into seat store
      updateTableState(seatPlan.tables);
      // Chunks are automatically managed by the seat store
    }
  }, [sessionId, loadSessionSeatPlan, updateTableState]);

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [tables]);

  const handleSave = () => {
    if (!eventId || !dayId) return;

    // Collect all assigned guest IDs from seats
    const activeGuestIds = new Set<string>();
    tables.forEach(table => {
      table.seats.forEach(seat => {
        if (seat.assignedGuestId) {
          activeGuestIds.add(seat.assignedGuestId);
        }
      });
    });

    saveSessionSeatPlan(eventId, dayId, sessionId, {
      tables,
      chunks,
      activeGuestIds: Array.from(activeGuestIds),
    });

    setHasUnsavedChanges(false);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Do you want to leave without saving?')) {
        setActiveSession(null);
        router.push(`/events/${eventId}`);
      }
    } else {
      setActiveSession(null);
      router.push(`/events/${eventId}`);
    }
  };

  if (!session) {
    return (
      <Box p={4}>
        <Typography>Loading session...</Typography>
      </Box>
    );
  }

  const totalGuests = (hostGuests.length || 0) + (externalGuests.length || 0);
  const sessionGuestCount = 
    (session.inheritedHostGuestIds?.length || 0) + 
    (session.inheritedExternalGuestIds?.length || 0);
  const hasNoGuests = sessionGuestCount === 0;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, zIndex: 10 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={handleBack}>
              <ArrowBack />
            </IconButton>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {session.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                <Chip
                  label={session.sessionType}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Typography variant="body2" color="text.secondary">
                  {new Date(session.startTime).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Stack>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              icon={<Groups />}
              label={`${sessionGuestCount} Attendees`}
              color={sessionGuestCount > 0 ? 'success' : 'default'}
              onClick={() => setGuestModalOpen(true)}
              sx={{ cursor: 'pointer' }}
            />
            
            <Button
              variant="outlined"
              startIcon={<Groups />}
              onClick={() => setGuestModalOpen(true)}
            >
              Manage Attendees
            </Button>

            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
            >
              Save Seating
            </Button>
          </Stack>
        </Stack>

        {hasNoGuests && (
          <Alert severity="warning" sx={{ mt: 2 }} icon={<Warning />}>
            No attendees assigned to this session. Click "Manage Attendees" to select guests from the master list.
          </Alert>
        )}
      </Paper>

      {/* Main Content - Seat Planner */}
      {hasNoGuests ? (
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#f5f5f5',
          }}
        >
          <Stack alignItems="center" spacing={3}>
            <EventSeat sx={{ fontSize: 80, color: 'text.secondary' }} />
            <Typography variant="h6" color="text.secondary">
              Assign attendees to start planning seats
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<Groups />}
              onClick={() => setGuestModalOpen(true)}
            >
              Manage Attendees
            </Button>
          </Stack>
        </Box>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 relative overflow-hidden">
            <PlaygroundTopControlPanel />
            <PlayGroundCanvas />
          </div>

          {/* Right Panel */}
          <div className="w-80 bg-gray-100 border-l border-gray-300 overflow-y-auto">
            <PlaygroundRightConfigPanel />
          </div>
        </div>
      )}

      {/* Guest Management Modal */}
      {eventId && dayId && (
        <SessionGuestListModal
          open={guestModalOpen}
          onClose={() => setGuestModalOpen(false)}
          eventId={eventId}
          dayId={dayId}
          sessionId={sessionId}
          sessionName={session.name}
        />
      )}
    </Box>
  );
}