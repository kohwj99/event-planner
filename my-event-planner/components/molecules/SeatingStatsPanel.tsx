// ============================================================================
// PART 3: Enhanced SeatingStatsPanel.tsx with Proximity Violations
// ============================================================================

'use client';

import { useState, useMemo } from 'react';
import {
  Fab,
  Paper,
  IconButton,
  Typography,
  Stack,
  Box,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
} from '@mui/material';
import {
  InfoOutlined,
  ArrowBack,
  Warning,
  CheckCircle,
  Error,
  Close,
  GroupAdd,
  PersonOff,
} from '@mui/icons-material';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { getProximityViolations } from '@/utils/seatAutoFillHelper';
import { detectProximityViolations } from '@/utils/violationDetector';

interface SeatingStats {
  totalSeats: number;
  seatedCount: number;
  unseatedCount: number;

  // Host stats
  hostTotal: number;
  hostSeated: number;
  hostUnseated: number;
  hostVIPsUnseated: string[];

  // External stats
  externalTotal: number;
  externalSeated: number;
  externalUnseated: number;
  externalVIPsUnseated: string[];

  // Overall VIP status
  totalVIPsUnseated: number;
  hasUnseatedVIPs: boolean;
  hasUnseatedGuests: boolean;

  // NEW: Proximity violations
  proximityViolations: any[];
}

type DetailView = 'overview' | 'vips' | 'violations';

export default function SeatingStatsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>('overview');

  const tables = useSeatStore((s) => s.tables);
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const guestLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    [...hostGuests, ...externalGuests].forEach((g) => {
      lookup[g.id] = g;
    });
    return lookup;
  }, [hostGuests, externalGuests]);
  // Calculate statistics
  const stats = useMemo((): SeatingStats => {
    // Get all seated guest IDs
    const seatedGuestIds = new Set<string>();
    let totalSeats = 0;

    tables.forEach((table) => {
      table.seats.forEach((seat) => {
        totalSeats++;
        if (seat.assignedGuestId) {
          seatedGuestIds.add(seat.assignedGuestId);
        }
      });
    });

    // Filter active guests
    const activeHostGuests = hostGuests.filter((g) => !g.deleted);
    const activeExternalGuests = externalGuests.filter((g) => !g.deleted);

    // Calculate host stats
    const hostSeatedIds = activeHostGuests
      .filter((g) => seatedGuestIds.has(g.id))
      .map((g) => g.id);
    const hostUnseatedGuests = activeHostGuests.filter(
      (g) => !seatedGuestIds.has(g.id)
    );
    const hostVIPsUnseated = hostUnseatedGuests
      .filter((g) => g.ranking <= 4)
      .map((g) => g.id);

    // Calculate external stats
    const externalSeatedIds = activeExternalGuests
      .filter((g) => seatedGuestIds.has(g.id))
      .map((g) => g.id);
    const externalUnseatedGuests = activeExternalGuests.filter(
      (g) => !seatedGuestIds.has(g.id)
    );
    const externalVIPsUnseated = externalUnseatedGuests
      .filter((g) => g.ranking <= 4)
      .map((g) => g.id);

    const totalVIPsUnseated = hostVIPsUnseated.length + externalVIPsUnseated.length;
    const totalUnseated = hostUnseatedGuests.length + externalUnseatedGuests.length;

    // Get proximity violations
    // const proximityViolations = getProximityViolations();
    const proximityViolations = detectProximityViolations(
      tables,
      { sitTogether: [], sitAway: [] }, // TODO: Get actual rules from state if available
      guestLookup
    );

    return {
      totalSeats,
      seatedCount: seatedGuestIds.size,
      unseatedCount: totalSeats - seatedGuestIds.size,

      hostTotal: activeHostGuests.length,
      hostSeated: hostSeatedIds.length,
      hostUnseated: hostUnseatedGuests.length,
      hostVIPsUnseated,

      externalTotal: activeExternalGuests.length,
      externalSeated: externalSeatedIds.length,
      externalUnseated: externalUnseatedGuests.length,
      externalVIPsUnseated,

      totalVIPsUnseated,
      hasUnseatedVIPs: totalVIPsUnseated > 0,
      hasUnseatedGuests: totalUnseated > 0,

      proximityViolations,
    };
  }, [tables, hostGuests, externalGuests]);

  // Get guest lookup


  // Determine status color
  const getStatusColor = (): 'error' | 'warning' | 'success' => {
    if (stats.hasUnseatedVIPs || stats.proximityViolations.length > 0) return 'error';
    if (stats.hasUnseatedGuests) return 'warning';
    return 'success';
  };

  const getStatusIcon = () => {
    const color = getStatusColor();
    if (color === 'error') return <Error />;
    if (color === 'warning') return <Warning />;
    return <CheckCircle />;
  };

  const handleToggle = () => {
    if (expanded) {
      setDetailView('overview');
    }
    setExpanded(!expanded);
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 24,
        right: 24,
        zIndex: 1100,
      }}
    >
      {!expanded ? (
        // Minimized button
        <Fab
          color={getStatusColor()}
          size="medium"
          onClick={handleToggle}
          sx={{
            boxShadow: 3,
            '&:hover': { boxShadow: 6 },
          }}
        >
          <InfoOutlined />
          {(stats.hasUnseatedVIPs || stats.proximityViolations.length > 0) && (
            <Box
              sx={{
                position: 'absolute',
                top: -4,
                right: -4,
                bgcolor: 'error.main',
                color: 'white',
                borderRadius: '50%',
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            >
              {stats.totalVIPsUnseated + stats.proximityViolations.length}
            </Box>
          )}
        </Fab>
      ) : (
        // Expanded panel
        <Paper
          elevation={6}
          sx={{
            width: 420,
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              bgcolor: getStatusColor() === 'error'
                ? 'error.main'
                : getStatusColor() === 'warning'
                  ? 'warning.main'
                  : 'success.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              {getStatusIcon()}
              <Typography variant="h6" fontWeight="bold">
                Seating Statistics
              </Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={handleToggle}
              sx={{ color: 'white' }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Tabs */}
          <Tabs
            value={detailView}
            onChange={(_, v) => setDetailView(v)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Overview" value="overview" />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  VIPs
                  {stats.totalVIPsUnseated > 0 && (
                    <Chip
                      label={stats.totalVIPsUnseated}
                      size="small"
                      color="error"
                      sx={{ height: 16, fontSize: 10 }}
                    />
                  )}
                </Box>
              }
              value="vips"
            />
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Violations
                  {stats.proximityViolations.length > 0 && (
                    <Chip
                      label={stats.proximityViolations.length}
                      size="small"
                      color="error"
                      sx={{ height: 16, fontSize: 10 }}
                    />
                  )}
                </Box>
              }
              value="violations"
            />
          </Tabs>

          {/* Content */}
          <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1 }}>
            {detailView === 'overview' && (
              <Stack spacing={2}>
                {/* Overall Status */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Overall Status
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`${stats.seatedCount} / ${stats.totalSeats} Seats Filled`}
                      size="small"
                      color={stats.unseatedCount === 0 ? 'success' : 'default'}
                    />
                    <Chip
                      label={`${stats.unseatedCount} Empty Seats`}
                      size="small"
                      color={stats.unseatedCount > 0 ? 'warning' : 'default'}
                    />
                  </Stack>
                </Box>

                {/* Alert Banners */}
                {stats.totalVIPsUnseated > 0 && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'error.light',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'error.main', color: 'white' },
                    }}
                    onClick={() => setDetailView('vips')}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" fontWeight="bold">
                        ⚠️ {stats.totalVIPsUnseated} VIPs Unseated
                      </Typography>
                      <Typography variant="caption">View →</Typography>
                    </Stack>
                  </Box>
                )}

                {stats.proximityViolations.length > 0 && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'error.light',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'error.main', color: 'white' },
                    }}
                    onClick={() => setDetailView('violations')}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" fontWeight="bold">
                        🚨 {stats.proximityViolations.length} Proximity Rule Violations
                      </Typography>
                      <Typography variant="caption">View →</Typography>
                    </Stack>
                  </Box>
                )}

                <Divider />

                {/* Host Guests */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Host Guests
                  </Typography>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Total:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {stats.hostTotal}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Seated:</Typography>
                      <Chip
                        label={stats.hostSeated}
                        size="small"
                        color="success"
                        sx={{ minWidth: 50 }}
                      />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Unseated:</Typography>
                      <Chip
                        label={stats.hostUnseated}
                        size="small"
                        color={stats.hostUnseated > 0 ? 'warning' : 'default'}
                        sx={{ minWidth: 50 }}
                      />
                    </Stack>
                  </Stack>
                </Box>

                <Divider />

                {/* External Guests */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    External Guests
                  </Typography>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Total:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {stats.externalTotal}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Seated:</Typography>
                      <Chip
                        label={stats.externalSeated}
                        size="small"
                        color="success"
                        sx={{ minWidth: 50 }}
                      />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Unseated:</Typography>
                      <Chip
                        label={stats.externalUnseated}
                        size="small"
                        color={stats.externalUnseated > 0 ? 'warning' : 'default'}
                        sx={{ minWidth: 50 }}
                      />
                    </Stack>
                  </Stack>
                </Box>
              </Stack>
            )}

            {detailView === 'vips' && (
              <Stack spacing={2}>
                {stats.hostVIPsUnseated.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      Host VIPs ({stats.hostVIPsUnseated.length})
                    </Typography>
                    <List dense disablePadding>
                      {stats.hostVIPsUnseated.map((guestId) => {
                        const guest = guestLookup[guestId];
                        if (!guest) return null;
                        return (
                          <ListItem
                            key={guestId}
                            sx={{
                              bgcolor: '#ffebee',
                              mb: 1,
                              borderRadius: 1,
                              border: '1px solid #ef5350',
                            }}
                          >
                            <ListItemText
                              primary={
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2" fontWeight="bold">
                                    {guest.salutation} {guest.name}
                                  </Typography>
                                  <Chip
                                    label={`Rank ${guest.ranking}`}
                                    size="small"
                                    color="error"
                                  />
                                </Stack>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {guest.title} • {guest.company} • {guest.country}
                                </Typography>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Box>
                )}

                {stats.externalVIPsUnseated.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      External VIPs ({stats.externalVIPsUnseated.length})
                    </Typography>
                    <List dense disablePadding>
                      {stats.externalVIPsUnseated.map((guestId) => {
                        const guest = guestLookup[guestId];
                        if (!guest) return null;
                        return (
                          <ListItem
                            key={guestId}
                            sx={{
                              bgcolor: '#ffebee',
                              mb: 1,
                              borderRadius: 1,
                              border: '1px solid #ef5350',
                            }}
                          >
                            <ListItemText
                              primary={
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="body2" fontWeight="bold">
                                    {guest.salutation} {guest.name}
                                  </Typography>
                                  <Chip
                                    label={`Rank ${guest.ranking}`}
                                    size="small"
                                    color="error"
                                  />
                                </Stack>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {guest.title} • {guest.company} • {guest.country}
                                </Typography>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Box>
                )}

                {stats.totalVIPsUnseated === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      All VIPs are seated
                    </Typography>
                  </Box>
                )}
              </Stack>
            )}

            {detailView === 'violations' && (
              <Stack spacing={2}>
                {stats.proximityViolations.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      No proximity rule violations
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* Sit Together Violations */}
                    {stats.proximityViolations.filter((v: any) => v.type === 'sit-together').length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="error" gutterBottom>
                          🤝 Sit Together Violations
                        </Typography>
                        <List dense disablePadding>
                          {stats.proximityViolations
                            .filter((v: any) => v.type === 'sit-together')
                            .map((violation: any, idx: number) => (
                              <ListItem
                                key={idx}
                                sx={{
                                  bgcolor: '#fff3e0',
                                  mb: 1,
                                  borderRadius: 1,
                                  border: '1px solid #ff9800',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                                  <GroupAdd fontSize="small" color="warning" />
                                  <Typography variant="body2" fontWeight="bold">
                                    {violation.guest1Name} & {violation.guest2Name}
                                  </Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  Should sit together but are not adjacent
                                </Typography>
                                <Chip
                                  label={`Table: ${violation.tableLabel}`}
                                  size="small"
                                  sx={{ mt: 0.5 }}
                                />
                              </ListItem>
                            ))}
                        </List>
                      </Box>
                    )}

                    {/* Sit Away Violations */}
                    {stats.proximityViolations.filter((v: any) => v.type === 'sit-away').length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="error" gutterBottom>
                          🚫 Sit Away Violations
                        </Typography>
                        <List dense disablePadding>
                          {stats.proximityViolations
                            .filter((v: any) => v.type === 'sit-away')
                            .map((violation: any, idx: number) => (
                              <ListItem
                                key={idx}
                                sx={{
                                  bgcolor: '#ffebee',
                                  mb: 1,
                                  borderRadius: 1,
                                  border: '1px solid #ef5350',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                                  <PersonOff fontSize="small" color="error" />
                                  <Typography variant="body2" fontWeight="bold">
                                    {violation.guest1Name} & {violation.guest2Name}
                                  </Typography>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  Should not sit together but are adjacent
                                </Typography>
                                <Chip
                                  label={`Table: ${violation.tableLabel}`}
                                  size="small"
                                  color="error"
                                  sx={{ mt: 0.5 }}
                                />
                              </ListItem>
                            ))}
                        </List>
                      </Box>
                    )}
                  </>
                )}
              </Stack>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}