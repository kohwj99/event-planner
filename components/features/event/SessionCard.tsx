'use client';

import {
  Card,
  CardContent,
  Chip,
  Stack,
  Box,
  Typography,
} from '@mui/material';
import {
  EventSeat,
  Groups,
  Schedule,
  Visibility,
  Description,
  Delete,
} from '@mui/icons-material';
import HoverActionStack from '@/components/shared/atoms/HoverActionStack';
import GuestCountBadge from '@/components/shared/atoms/GuestCountBadge';
import type { HoverAction } from '@/components/shared/atoms/HoverActionStack';

interface SessionCardSession {
  id: string;
  name: string;
  sessionType: string;
  startTime: string;
  description?: string;
  inheritedHostGuestIds?: string[];
  inheritedExternalGuestIds?: string[];
  seatPlan: { tables: unknown[] };
}

interface SessionCardProps {
  session: SessionCardSession;
  isTracked: boolean;
  isMounted: boolean;
  onSessionClick: (sessionId: string) => void;
  onManageGuests: (sessionId: string, sessionName: string) => void;
  onDelete: (sessionId: string, sessionName: string) => void;
}

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

const formatTime = (dateString: string, isMounted: boolean): string => {
  if (!isMounted) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SessionCard({
  session,
  isTracked,
  isMounted,
  onSessionClick,
  onManageGuests,
  onDelete,
}: SessionCardProps) {
  const hostCount = session.inheritedHostGuestIds?.length || 0;
  const externalCount = session.inheritedExternalGuestIds?.length || 0;
  const hasSeatPlan = session.seatPlan.tables.length > 0;

  const hoverActions: HoverAction[] = [
    {
      icon: <Groups fontSize="small" />,
      onClick: () => onManageGuests(session.id, session.name),
      color: 'primary',
    },
    {
      icon: <Delete fontSize="small" />,
      onClick: () => onDelete(session.id, session.name),
      color: 'error',
    },
  ];

  return (
    <Card
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
      <HoverActionStack actions={hoverActions} className="session-actions" />

      <CardContent
        onClick={() => onSessionClick(session.id)}
        sx={{ p: '12px !important', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header: Title & Status Chips */}
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography
              variant="subtitle1"
              fontWeight="700"
              sx={{
                lineHeight: 1.2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
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

        {/* Info: Type & Time */}
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Chip label={session.sessionType} size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: getSessionColor(session.sessionType), color: 'white' }} />
          {isMounted && (
            <Chip icon={<Schedule sx={{ fontSize: '14px !important' }} />} label={formatTime(session.startTime, isMounted)} variant="outlined" size="small" sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'background.paper' }} />
          )}
        </Stack>

        {/* Description */}
        {session.description && (
          <Box
            sx={{
              mb: 1.5,
              p: 1,
              bgcolor: 'rgba(0,0,0,0.04)',
              borderRadius: 1,
              display: 'flex',
              gap: 1,
              maxHeight: '80px',
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px' },
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Description sx={{ fontSize: 14, color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
              {session.description}
            </Typography>
          </Box>
        )}

        {/* Footer: Guest Counts */}
        <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
          <GuestCountBadge
            icon={<Groups sx={{ fontSize: 14 }} />}
            label="Host"
            count={hostCount}
            activeColor="#16a34a"
            activeBgColor="#f0fdf4"
            activeBorderColor="#bbf7d0"
          />
          <GuestCountBadge
            icon={<Groups sx={{ fontSize: 14 }} />}
            label="Ext"
            count={externalCount}
            activeColor="#7c3aed"
            activeBgColor="#f5f3ff"
            activeBorderColor="#ddd6fe"
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
