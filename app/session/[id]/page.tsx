'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useNavigation } from '@/components/providers/NavigationProvider';
import { useEventStore } from '@/store/eventStore';
import { useGuestStore } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import { useSessionLoader } from '@/hooks/useSessionLoader';
import {
  Box,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import {
  EventSeat,
  Groups,
} from '@mui/icons-material';
import PlayGroundCanvas from '@/components/features/session/PlaygroundCanvas';
import PlaygroundRightConfigPanel from '@/components/features/session/PlaygroundRightConfigPanel';
import ExportModal from '@/components/features/session/ExportModal';
import SeatingStatsPanel from '@/components/features/session/SeatingStatsPanel';
import { exportToPDF } from '@/utils/exportToPDF';
import { exportToPPTX } from '@/utils/exportToPPTX';
import PlaygroundTopControlPanel from '@/components/features/session/PlaygroundTopControlPanel';
import SessionDetailLayout from './layout';
import SessionGuestListModal from '@/components/features/guest/SessionGuestListModal';
import ChunkLayoutModal from '@/components/features/session/ChunkLayoutModal';
import { computeChunkLayout, ChunkLayoutConfig } from '@/utils/chunkLayoutHelper';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { UndoRedoProvider } from '@/components/providers/UndoRedoProvider';
import PageLoader from '@/components/shared/atoms/PageLoader';

export default function SessionDetailPage() {
  const { id: sessionId } = useParams() as { id: string };
  const { navigateWithLoading } = useNavigation();

  // 🆕 Use session loader hook - now returns UI settings and lock state
  const { 
    saveCurrentSession,
    isHydrated,
    uiSettings, 
    isLocked, 
    handleUISettingsChange, 
    handleToggleLock,
  } = useSessionLoader(sessionId);

  // Undo/Redo
  const { captureSnapshot } = useUndoRedo({
    sessionId,
    isLocked,
  });

  // Event Store
  const getSessionById = useEventStore((s) => s.getSessionById);
  const events = useEventStore((s) => s.events);

  // Guest Store - for display only
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);

  // Seat Store - for reset
  const resetTables = useSeatStore((s) => s.resetTables);

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [chunkLayoutOpen, setChunkLayoutOpen] = useState(false);

  // Reactive table count for ChunkLayoutModal
  const tableCount = useSeatStore((s) => s.tables.length);
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
      navigateWithLoading(`/events/${sessionData.eventId}`, 'Loading event...');
    } else {
      navigateWithLoading('/');
    }
  };

  // 🆕 Check lock state before reset
  const handleReset = () => {
    if (isLocked) {
      alert('Cannot reset - session is locked. Unlock first to make changes.');
      return;
    }
    
    if (confirm('Are you sure you want to reset all tables? This will clear all seating arrangements.')) {
      captureSnapshot("Reset Tables");
      resetTables();
    }
  };

  const handleExportPDF = () => {
    exportToPDF("playground-canvas");
  };

  const handleExportPPTX = () => {
    exportToPPTX();
  };

  const handleChunkLayoutApply = (config: ChunkLayoutConfig) => {
    if (isLocked) return;
    const currentTables = useSeatStore.getState().tables;
    if (currentTables.length === 0) return;

    captureSnapshot("Chunk Layout");

    const result = computeChunkLayout(currentTables, config);
    useSeatStore.setState({
      tables: result.tables,
      chunks: result.chunks,
    });

    setChunkLayoutOpen(false);
  };

  // Show loading spinner during initial load
  if (!isMounted || isLoading || !isHydrated) {
    return <PageLoader message="Loading session..." />;
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
    <UndoRedoProvider captureSnapshot={captureSnapshot}>
    <SessionDetailLayout
      header={
        <PlaygroundTopControlPanel
          sessionName={session.name}
          sessionType={session.sessionType}
          formattedDate={formattedDate}
          hasNoGuests={hasNoGuests}
          isLocked={isLocked}
          onBack={handleBack}
          onSave={handleSave}
          onReset={handleReset}
          onManageGuests={() => setGuestModalOpen(true)}
          onExport={() => setExportModalOpen(true)}
          onToggleLock={handleToggleLock}
          onChunkLayout={() => setChunkLayoutOpen(true)}
        />
      }
    >

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
              disabled={isLocked}
            >
              Manage Guests
            </Button>
          </Stack>
        </Box>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 relative overflow-hidden" id="playground-canvas">
            {/* 🆕 Pass UI settings and lock state to canvas */}
            <PlayGroundCanvas 
              sessionType={session.sessionType}
              isLocked={isLocked}
              initialUISettings={uiSettings}
              onUISettingsChange={handleUISettingsChange}
            />

            {/* Seating Stats Panel with Boss Adjacency */}
            <SeatingStatsPanel
              eventId={eventId}
              sessionId={sessionId}
            />
          </div>

          {/* Right Panel - 🆕 Pass lock state */}
          <div className="w-80 bg-gray-100 border-l border-gray-300 overflow-y-auto">
            <PlaygroundRightConfigPanel isLocked={isLocked} />
          </div>
        </div>
      )}

      {/* Unified Guest Management Modal */}
      <SessionGuestListModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        eventId={eventId}
        dayId={dayId}
        sessionId={sessionId}
        sessionName={session.name}
        showSeatingStatus={true}
      />

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExportPDF={handleExportPDF}
        onExportPPTX={handleExportPPTX}
      />

      {/* Chunk Layout Modal */}
      <ChunkLayoutModal
        open={chunkLayoutOpen}
        onClose={() => setChunkLayoutOpen(false)}
        onApply={handleChunkLayoutApply}
        tableCount={tableCount}
      />
    </SessionDetailLayout>
    </UndoRedoProvider>
  );
}