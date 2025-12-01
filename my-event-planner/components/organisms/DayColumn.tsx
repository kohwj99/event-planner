'use client';

import { useState, useEffect, useMemo } from 'react';
import { EventDay } from '@/types/Event';
import {
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Stack,
  Box,
} from '@mui/material';
import {
  Add,
  Delete,
  EventSeat,
  Groups,
  Schedule,
  Visibility,
} from '@mui/icons-material';
import { useEventStore } from '@/store/eventStore';

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
      (a, b) =>
        new Date(a.startTime).getTime() -
        new Date(b.startTime).getTime()
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

  const formatTime = (dateString: string): string => {
    if (!isMounted) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /* ✅ FIXED: YOUR REAL SESSION TYPES */
  const getSessionColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'executive meeting':
        return '#1e40af'; // Blue
      case 'bilateral meeting':
        return '#047857'; // Green
      case 'meal':
        return '#c2410c'; // Orange
      case 'phototaking':
        return '#6b21a8'; // Purple
      default:
        return '#9e9e9e';
    }
  };

  const getSessionBgColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'executive meeting':
        return '#e8f0fe';
      case 'bilateral meeting':
        return '#e7f7ef';
      case 'meal':
        return '#fff3e0';
      case 'phototaking':
        return '#f3e5f5';
      default:
        return '#fafafa';
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        minWidth: 320,
        maxWidth: 320,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
      }}
    >
      {/* Day Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.9 }}>
            Day {dayIndex + 1}
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {formatDate(day.date)}
          </Typography>
        </Box>

        <IconButton
          size="small"
          sx={{ color: 'white' }}
          onClick={() => onDeleteDay(day.id, dayIndex, day.sessions.length)}
        >
          <Delete />
        </IconButton>
      </Box>

      {/* Sessions List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        <Stack spacing={2}>
          {sortedSessions.map((session) => {
            const hostCount = session.inheritedHostGuestIds?.length || 0;
            const externalCount =
              session.inheritedExternalGuestIds?.length || 0;

            const hasSeatPlan = session.seatPlan.tables.length > 0;
            const isTracked = isSessionTracked(eventId, session.id);

            return (
              <Card
                key={session.id}
                variant="outlined"
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  bgcolor: isTracked
                    ? '#fff8e1'
                    : getSessionBgColor(session.sessionType),
                  borderLeft: `6px solid ${getSessionColor(
                    session.sessionType
                  )}`,

                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  },

                  '&:hover .session-actions': {
                    opacity: 1,
                    right: 8,
                  },
                }}
              >
                {/* HOVER ACTION BAR */}
                <Box
                  className="session-actions"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    right: -16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    opacity: 0,
                    transition: '0.25s ease',
                    zIndex: 10,
                  }}
                >
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onManageSessionGuests(
                        session.id,
                        session.name
                      );
                    }}
                  >
                    <Groups />
                  </IconButton>

                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(
                        session.id,
                        session.name,
                        day.id
                      );
                    }}
                  >
                    <Delete />
                  </IconButton>
                </Box>

                <CardContent
                  onClick={() => onSessionClick(session.id)}
                  sx={{ position: 'relative' }}
                >
                  {/* TOP RIGHT STATUS */}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                    }}
                  >
                    {isTracked && (
                      <Chip
                        label="Tracked"
                        icon={<Visibility />}
                        size="small"
                        color="warning"
                        sx={{ fontWeight: 600 }}
                      />
                    )}

                    {hasSeatPlan && (
                      <Chip
                        label="Seats planned"
                        icon={<EventSeat />}
                        size="small"
                        color="info"
                      />
                    )}
                  </Stack>

                  <Typography variant="h6" gutterBottom sx={{ pr: 8 }}>
                    {session.name}
                  </Typography>

                  {/* SESSION TYPE + TIME */}
                  <Stack
                    direction="row"
                    spacing={1}
                    mb={1}
                    alignItems="center"
                  >
                    <Chip
                      label={session.sessionType}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />

                    {isMounted && (
                      <Chip
                        icon={<Schedule />}
                        label={formatTime(session.startTime)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>

                  {/* GUEST COUNTS */}
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <Chip
                      icon={<Groups />}
                      label={`Host: ${hostCount}`}
                      size="small"
                      color={
                        hostCount > 0 ? 'success' : 'default'
                      }
                      variant="outlined"
                    />

                    <Chip
                      icon={<Groups />}
                      label={`External: ${externalCount}`}
                      size="small"
                      color={
                        externalCount > 0
                          ? 'secondary'
                          : 'default'
                      }
                      variant="outlined"
                    />
                  </Stack>

                  {session.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                      noWrap
                    >
                      {session.description}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>

        {day.sessions.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <EventSeat
              sx={{ fontSize: 48, opacity: 0.3, mb: 1 }}
            />
            <Typography variant="body2">
              No sessions yet
            </Typography>
          </Box>
        )}
      </Box>

      {/* Add Session Button */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Add />}
          onClick={() => onAddSession(day.id)}
        >
          Add Session
        </Button>
      </Box>
    </Paper>
  );
}
