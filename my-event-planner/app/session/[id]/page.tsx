// app/events/[eventId]/sessions/[id]/page.tsx
// Session detail page with Plan/Draw mode support

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEventStore } from '@/store/eventStore';
import { useGuestStore } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import { useDrawingStore } from '@/store/drawingStore';
import { useSessionLoader } from '@/hooks/useSessionLoader';
import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  EventSeat,
  Groups,
} from '@mui/icons-material';
import PlayGroundCanvas from '@/components/organisms/PlaygroundCanvas';
import PlaygroundRightConfigPanel from '@/components/organisms/PlaygroundRightConfigPanel';
import DrawingConfigPanel from '@/components/organisms/DrawingConfigPanel';
import ExportModal from '@/components/molecules/ExportModal';
import SeatingStatsPanel from '@/components/molecules/SeatingStatsPanel';
import { exportToPDF } from '@/utils/exportToPDF';
import { exportToPPTX } from '@/utils/exportToPPTX';
import PlaygroundTopControlPanel, { CanvasMode } from '@/components/organisms/PlaygroundTopControlPanel';
import SessionDetailLayout from './layout';
import SessionGuestListModal from '@/components/molecules/SessionGuestListModal';
import { DrawingColorOption, getDefaultDrawingColor } from '@/utils/drawingColorConfig';
import { DrawingShapeType } from '@/types/DrawingShape';
import { useColorModeStore } from '@/store/colorModeStore';

export default function SessionDetailPage() {
  const { id: sessionId } = useParams() as { id: string };
  const router = useRouter();

  // Use session loader hook
  const { 
    saveCurrentSession,
    isHydrated,
    uiSettings, 
    isLocked, 
    handleUISettingsChange, 
    handleToggleLock,
    drawingLayerState,
    handleDrawingLayerChange,
  } = useSessionLoader(sessionId);

  // Event Store
  const getSessionById = useEventStore((s) => s.getSessionById);
  const events = useEventStore((s) => s.events);

  // Guest Store - for display only
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);

  // Seat Store - for reset
  const resetTables = useSeatStore((s) => s.resetTables);

  // Drawing Store
  const { addShape, getDrawingLayerState } = useDrawingStore();
  const colorMode = useColorModeStore((s) => s.colorMode);

  // Local state
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [sessionData, setSessionData] = useState<{
    session: any;
    dayId: string;
    eventId: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  // Canvas mode: 'plan' or 'draw'
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('plan');

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

  // Handle save - includes drawing layer
  const handleSave = useCallback(() => {
    // Save drawing layer state
    const currentDrawingState = getDrawingLayerState();
    handleDrawingLayerChange(currentDrawingState);
    
    saveCurrentSession();
    alert('Session saved successfully!');
  }, [saveCurrentSession, getDrawingLayerState, handleDrawingLayerChange]);

  const handleBack = () => {
    // Save before navigating away
    const currentDrawingState = getDrawingLayerState();
    handleDrawingLayerChange(currentDrawingState);
    saveCurrentSession();
    
    if (sessionData) {
      router.push(`/events/${sessionData.eventId}`);
    } else {
      router.push('/');
    }
  };

  // Check lock state before reset
  const handleReset = () => {
    if (isLocked) {
      alert('Cannot reset - session is locked. Unlock first to make changes.');
      return;
    }
    
    if (confirm('Are you sure you want to reset all tables? This will clear all seating arrangements.')) {
      resetTables();
    }
  };

  const handleExportPDF = () => {
    exportToPDF("playground-canvas");
  };

  const handleExportPPTX = () => {
    exportToPPTX();
  };

  // Handle canvas mode change
  const handleCanvasModeChange = useCallback((mode: CanvasMode) => {
    // Save drawing state when switching away from draw mode
    if (canvasMode === 'draw' && mode === 'plan') {
      const currentDrawingState = getDrawingLayerState();
      handleDrawingLayerChange(currentDrawingState);
    }
    setCanvasMode(mode);
  }, [canvasMode, getDrawingLayerState, handleDrawingLayerChange]);

  // Handle adding a new shape from the drawing panel
  const handleAddShape = useCallback((type: DrawingShapeType, color: DrawingColorOption) => {
    // Add shape at center of visible canvas area
    // In a real implementation, you'd calculate this based on current viewport
    const centerX = 400;
    const centerY = 300;
    addShape(type, centerX, centerY, color.fill, color.stroke);
  }, [addShape]);

  // Show loading spinner during initial load
  if (!isMounted || isLoading || !isHydrated) {
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
    <SessionDetailLayout
      header={
        <PlaygroundTopControlPanel
          sessionName={session.name}
          sessionType={session.sessionType}
          formattedDate={formattedDate}
          hasNoGuests={hasNoGuests}
          isLocked={isLocked}
          canvasMode={canvasMode}
          onBack={handleBack}
          onSave={handleSave}
          onReset={handleReset}
          onManageGuests={() => setGuestModalOpen(true)}
          onExport={() => setExportModalOpen(true)}
          onToggleLock={handleToggleLock}
          onCanvasModeChange={handleCanvasModeChange}
        />
      }
    >

      {/* Main Content - Seat Planner */}
      {hasNoGuests && canvasMode === 'plan' ? (
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
            {/* Pass canvas mode and lock state to canvas */}
            <PlayGroundCanvas 
              sessionType={session.sessionType}
              isLocked={isLocked}
              initialUISettings={uiSettings}
              onUISettingsChange={handleUISettingsChange}
              canvasMode={canvasMode}
            />

            {/* Seating Stats Panel - only show in plan mode */}
            {canvasMode === 'plan' && (
              <SeatingStatsPanel
                eventId={eventId}
                sessionId={sessionId}
              />
            )}
          </div>

          {/* Right Panel - switches based on mode */}
          <div className="w-80 bg-gray-100 border-l border-gray-300 overflow-y-auto">
            {canvasMode === 'plan' ? (
              <PlaygroundRightConfigPanel isLocked={isLocked} />
            ) : (
              <DrawingConfigPanel onAddShape={handleAddShape} />
            )}
          </div>
        </div>
      )}

      {/* Unified Guest Management Modal - only functional in plan mode */}
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
    </SessionDetailLayout>
  );
}