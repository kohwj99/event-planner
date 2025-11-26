'use client';

import { useState, useEffect } from 'react';
import { EventDay } from '@/types/Event';
import {
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
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
} from '@mui/icons-material';

interface DayColumnProps {
  day: EventDay;
  dayIndex: number;
  onAddSession: (dayId: string) => void;
  onDeleteDay: (dayId: string, dayIndex: number, sessionCount: number) => void;
  onDeleteSession: (sessionId: string, sessionName: string, dayId: string) => void;
  onSessionClick: (sessionId: string) => void;
  onManageSessionGuests: (sessionId: string, sessionName: string) => void;
}

export default function DayColumn({
  day,
  dayIndex,
  onAddSession,
  onDeleteDay,
  onDeleteSession,
  onSessionClick,
  onManageSessionGuests,
}: DayColumnProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formatDate = (dateString: string) => {
    if (!isMounted) return 'Loading...';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    if (!isMounted) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
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
          {day.sessions.map((session) => {
            const guestCount =
              (session.inheritedHostGuestIds?.length || 0) +
              (session.inheritedExternalGuestIds?.length || 0);
            const hasSeatPlan = session.seatPlan.tables.length > 0;

            return (
              <Card
                key={session.id}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent onClick={() => onSessionClick(session.id)}>
                  <Typography variant="h6" gutterBottom>
                    {session.name}
                  </Typography>

                  <Stack direction="row" spacing={1} mb={1}>
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

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      icon={<Groups />}
                      label={`${guestCount} guests`}
                      size="small"
                      color={guestCount > 0 ? 'success' : 'default'}
                    />
                    {hasSeatPlan && (
                      <Chip
                        icon={<EventSeat />}
                        label="Seats planned"
                        size="small"
                        color="info"
                      />
                    )}
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

                <CardActions sx={{ justifyContent: 'space-between', px: 2 }}>
                  <Button
                    size="small"
                    startIcon={<Groups />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onManageSessionGuests(session.id, session.name);
                    }}
                  >
                    Guests
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id, session.name, day.id);
                    }}
                  >
                    Delete
                  </Button>
                </CardActions>
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
            <EventSeat sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
            <Typography variant="body2">No sessions yet</Typography>
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