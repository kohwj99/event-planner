'use client';

import { useState, useEffect, useMemo } from 'react';
import { EventDay } from '@/types/Event';
import {
  Paper,
  Typography,
  Button,
  IconButton,
  Stack,
  Box,
} from '@mui/material';
import {
  Add,
  Delete,
} from '@mui/icons-material';
import { useEventStore } from '@/store/eventStore';
import SessionCard from './SessionCard';

interface DayColumnProps {
  day: EventDay;
  dayIndex: number;
  eventId: string;
  onAddSession: (dayId: string) => void;
  onDeleteDay: (dayId: string, dayIndex: number, sessionCount: number) => void;
  onDeleteSession: (sessionId: string, sessionName: string, dayId: string) => void;
  onSessionClick: (sessionId: string) => void;
  onManageSessionGuests: (sessionId: string, sessionName: string) => void;
}

export default function DayColumn({
  day,
  dayIndex,
  eventId,
  onAddSession,
  onDeleteDay,
  onDeleteSession,
  onSessionClick,
  onManageSessionGuests,
}: DayColumnProps) {
  const [isMounted, setIsMounted] = useState(false);
  const isSessionTracked = useEventStore((s) => s.isSessionTracked);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sortedSessions = useMemo(() => {
    return [...day.sessions].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [day.sessions]);

  const formatDate = (dateString: string): string => {
    if (!isMounted) return 'Loading...';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        minWidth: 340,
        maxWidth: 340,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#f1f5f9',
        overflow: 'hidden',
      }}
    >
      {/* Day Header */}
      <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.8, lineHeight: 1, fontWeight: 700 }}>
            Day {dayIndex + 1}
          </Typography>
          <Typography variant="h6" fontWeight="800">
            {formatDate(day.date)}
          </Typography>
        </Box>
        <IconButton
          size="small"
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
          onClick={() => onDeleteDay(day.id, dayIndex, day.sessions.length)}
        >
          <Delete fontSize="small" />
        </IconButton>
      </Box>

      {/* Sessions List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5 }}>
        <Stack spacing={2}>
          {sortedSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isTracked={isSessionTracked(eventId, session.id)}
              isMounted={isMounted}
              onSessionClick={onSessionClick}
              onManageGuests={onManageSessionGuests}
              onDelete={(sessionId, sessionName) => onDeleteSession(sessionId, sessionName, day.id)}
            />
          ))}
        </Stack>
      </Box>

      {/* Add Session Button */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<Add />}
          onClick={() => onAddSession(day.id)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
        >
          Add Session
        </Button>
      </Box>
    </Paper>
  );
}
