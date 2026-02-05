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
  Description,
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

  const formatTime = (dateString: string): string => {
    if (!isMounted) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSessionColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'executive meeting': return '#1e40af';
      case 'bilateral meeting': return '#047857';
      case 'meal': return '#c2410c';
      case 'phototaking': return '#6b21a8';
      default: return '#64748b';
    }
  };

  const getSessionBgColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'executive meeting': return '#eff6ff';
      case 'bilateral meeting': return '#f0fdf4';
      case 'meal': return '#fff7ed';
      case 'phototaking': return '#faf5ff';
      default: return '#f8fafc';
    }
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
          {sortedSessions.map((session) => {
            const hostCount = session.inheritedHostGuestIds?.length || 0;
            const externalCount = session.inheritedExternalGuestIds?.length || 0;
            const hasSeatPlan = session.seatPlan.tables.length > 0;
            const isTracked = isSessionTracked(eventId, session.id);

            return (
              <Card
                key={session.id}
                elevation={0}
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  transition: '0.2s ease',
                  bgcolor: isTracked ? '#fffdf0' : getSessionBgColor(session.sessionType),
                  border: '1px solid',
                  borderColor: isTracked ? '#fde68a' : 'divider',
                  borderLeft: `6px solid ${getSessionColor(session.sessionType)}`,
                  borderRadius: 2,
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transform: 'translateY(-2px)',
                  },
                  '&:hover .session-actions': { opacity: 1, right: 8 },
                }}
              >
                {/* HOVER ACTIONS */}
                <Box
                  className="session-actions"
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: -40,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    opacity: 0,
                    transition: '0.2s ease',
                    zIndex: 10,
                    bgcolor: 'background.paper',
                    borderRadius: 1.5,
                    p: 0.5,
                    boxShadow: 2,
                  }}
                >
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); onManageSessionGuests(session.id, session.name); }}>
                    <Groups fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id, session.name, day.id); }}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>

                <CardContent 
                   onClick={() => onSessionClick(session.id)} 
                   sx={{ p: '12px !important', display: 'flex', flexDirection: 'column' }}
                >
                  {/* HEADER ROW: Title & Status Chips */}
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight="700" sx={{ 
                          lineHeight: 1.2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                      }}>
                        {session.name}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                      {isTracked && (
                        <Chip icon={<Visibility style={{ fontSize: 12 }} />} label="Tracked" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                      )}
                      {hasSeatPlan && (
                        <Chip icon={<EventSeat style={{ fontSize: 12 }} />} label="Seated" size="small" color="info" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                      )}
                    </Stack>
                  </Stack>

                  {/* INFO ROW: Type & Time */}
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip label={session.sessionType} size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: getSessionColor(session.sessionType), color: 'white' }} />
                    {isMounted && (
                      <Chip icon={<Schedule sx={{ fontSize: '14px !important' }} />} label={formatTime(session.startTime)} variant="outlined" size="small" sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'background.paper' }} />
                    )}
                  </Stack>

                  {/* DESCRIPTION AREA - Scrollable */}
                  {session.description && (
                    <Box 
                      sx={{ 
                        mb: 1.5, 
                        p: 1, 
                        bgcolor: 'rgba(0,0,0,0.04)', 
                        borderRadius: 1,
                        display: 'flex',
                        gap: 1,
                        maxHeight: '80px', // Limits height so card doesn't get too long
                        overflowY: 'auto', // Enables scrolling
                        '&::-webkit-scrollbar': { width: '4px' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px' }
                      }}
                      onClick={(e) => e.stopPropagation()} // Prevent card click when scrolling
                    >
                      <Description sx={{ fontSize: 14, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                        {session.description}
                      </Typography>
                    </Box>
                  )}

                  {/* FOOTER ROW: Guest Counts */}
                  <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                    <Box sx={{ 
                      display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: 1, border: '1px solid', 
                      borderColor: hostCount > 0 ? '#bbf7d0' : '#e2e8f0', bgcolor: hostCount > 0 ? '#f0fdf4' : 'transparent'
                    }}>
                      <Groups sx={{ fontSize: 14, color: hostCount > 0 ? '#16a34a' : '#94a3b8' }} />
                      <Typography variant="caption" fontWeight="600" color={hostCount > 0 ? '#166534' : '#64748b'}>
                        Host: {hostCount}
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: 1, border: '1px solid', 
                      borderColor: externalCount > 0 ? '#ddd6fe' : '#e2e8f0', bgcolor: externalCount > 0 ? '#f5f3ff' : 'transparent'
                    }}>
                      <Groups sx={{ fontSize: 14, color: externalCount > 0 ? '#7c3aed' : '#94a3b8' }} />
                      <Typography variant="caption" fontWeight="600" color={externalCount > 0 ? '#5b21b6' : '#64748b'}>
                        Ext: {externalCount}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
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