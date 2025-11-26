'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEventStore } from '@/store/eventStore';
import { useGuestStore } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import { useSessionLoader } from '@/hooks/useSessionLoader';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  Stack,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Groups,
  EventSeat,
  Warning,
  FileDownload,
  RestartAlt,
} from '@mui/icons-material';
import PlayGroundCanvas from '@/components/organisms/PlaygroundCanvas';
import PlaygroundRightConfigPanel from '@/components/organisms/PlaygroundRightConfigPanel';
import GuestManagementModal from '@/components/molecules/GuestManagementModal';
import ExportModal from '@/components/molecules/ExportModal';
import AutoFillButton from '@/components/atoms/AutoFillButton';
import { exportToPDF } from '@/utils/exportToPDF';
import { exportToPPTX } from '@/utils/exportToPPTX';

export default function SessionDetailPage() {
  const { id: sessionId } = useParams() as { id: string };
  const router = useRouter();

  // Use session loader hook for automatic save/load
  const { saveCurrentSession } = useSessionLoader(sessionId);

  // Event Store
  const getSessionById = useEventStore((s) => s.getSessionById);
  const events = useEventStore((s) => s.events);

  // Guest Store - for display only
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);

  // Seat Store - for reset and export
  const tables = useSeatStore((s) => s.tables);
  const resetTables = useSeatStore((s) => s.resetTables);

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [sessionData, setSessionData] = useState<{
    session: any;
    dayId: string;
    eventId: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Fix hydration by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Find session data
  useEffect(() => {
    if (!sessionId) return;

    const data = getSessionById(sessionId);
    if (data) {
      setSessionData(data);
      setIsLoading(false);
    } else {
      console.error('Session not found');
      setIsLoading(false);
    }
  }, [sessionId, events, getSessionById]);

  const handleSave = () => {
    saveCurrentSession();
    alert('Seating plan saved successfully!');
  };

  const handleBack = () => {
    saveCurrentSession();
    if (sessionData) {
      router.push(`/events/${sessionData.eventId}`);
    } else {
      router.push('/');
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all tables? This will clear all seating arrangements.')) {
      resetTables();
    }
  };

  const handleExportPDF = () => {
    exportToPDF("playground-canvas");
  };

  const handleExportPPTX = () => {
    exportToPPTX(tables);
  };

  // Show loading spinner during initial load
  if (!isMounted || isLoading) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!sessionData) {
    return (
      <Box p={4}>
        <Typography variant="h6" color="error">
          Session not found
        </Typography>
        <Button onClick={() => router.push('/')} sx={{ mt: 2 }}>
          Return to Dashboard
        </Button>
      </Box>
    );
  }

  const { session, eventId, dayId } = sessionData;

  const totalGuests = (hostGuests.length || 0) + (externalGuests.length || 0);
  const activeGuests = [...hostGuests, ...externalGuests].filter(g => !g.deleted).length;
  const sessionGuestCount =
    (session.inheritedHostGuestIds?.length || 0) +
    (session.inheritedExternalGuestIds?.length || 0);
  const hasNoGuests = sessionGuestCount === 0;

  // Format date on client side only
  const formattedDate = new Date(session.startTime).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Combined Header */}
      <Paper elevation={2} sx={{ p: 2, zIndex: 10 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {/* LEFT SIDE - Session Info */}
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
                  {formattedDate}
                </Typography>
              </Stack>
            </Box>
          </Stack>

          {/* RIGHT SIDE - Action Buttons */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Divider orientation="vertical" flexItem />

            {/* Manage Guests Button */}
            <Button
              variant="contained"
              color="primary"
              startIcon={<Groups />}
              onClick={() => setGuestModalOpen(true)}
            >
              Manage Guests
            </Button>

            {/* Auto Fill Button */}
            <AutoFillButton />

            {/* Export Button */}
            <Button
              variant="contained"
              color="secondary"
              startIcon={<FileDownload />}
              onClick={() => setExportModalOpen(true)}
            >
              Export
            </Button>

            {/* Reset Button */}
            <Button
              variant="contained"
              color="error"
              startIcon={<RestartAlt />}
              onClick={handleReset}
            >
              Reset
            </Button>

            <Divider orientation="vertical" flexItem />

            {/* Save Button */}
            <Button
              variant="contained"
              color="success"
              startIcon={<Save />}
              onClick={handleSave}
              size="large"
            >
              Save
            </Button>
          </Stack>
        </Stack>

        {hasNoGuests && (
          <Alert severity="warning" sx={{ mt: 2 }} icon={<Warning />}>
            No attendees assigned to this session. Click "Manage Guests" → "Manage Attendees" tab to select guests from the master list.
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
              Manage Guests
            </Button>
          </Stack>
        </Box>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 relative overflow-hidden" id="playground-canvas">
            <PlayGroundCanvas />
          </div>

          {/* Right Panel */}
          <div className="w-80 bg-gray-100 border-l border-gray-300 overflow-y-auto">
            <PlaygroundRightConfigPanel />
          </div>
        </div>
      )}

      {/* Unified Guest Management Modal */}
      <GuestManagementModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        eventId={eventId}
        dayId={dayId}
        sessionId={sessionId}
        sessionName={session.name}
      />

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExportPDF={handleExportPDF}
        onExportPPTX={handleExportPPTX}
      />
    </Box>
  );
}