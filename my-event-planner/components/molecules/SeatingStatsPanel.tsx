// SeatingStatsPanel.tsx - WITH BOSS ADJACENCY TRACKING
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  InfoOutlined,
  Warning,
  CheckCircle,
  Error,
  Close,
  GroupAdd,
  PersonOff,
  Visibility,
  ExpandMore,
} from '@mui/icons-material';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { useEventStore } from '@/store/eventStore';
import { getEnhancedAdjacentSeats } from '@/utils/adjacencyHelper';
// Note: violations are now read directly from seatStore

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

  // Proximity violations
  proximityViolations: any[];
}

type DetailView = 'overview' | 'vips' | 'violations' | 'adjacency';

interface SeatingStatsPanelProps {
  eventId: string;
  sessionId: string;
}

export default function SeatingStatsPanel({ eventId, sessionId }: SeatingStatsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>('overview');

  const tables = useSeatStore((s) => s.tables);
  const violations = useSeatStore((s) => s.violations); // Read violations from store
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  
  // Tracking - now from eventStore (consolidated)
  const isSessionTracked = useEventStore((s) => s.isSessionTracked);
  const getTrackedGuests = useEventStore((s) => s.getTrackedGuests);
  const getFilteredTrackedGuestHistory = useEventStore((s) => s.getFilteredTrackedGuestHistory);
  
  const guestLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    [...hostGuests, ...externalGuests].forEach((g) => {
      lookup[g.id] = g;
    });
    return lookup;
  }, [hostGuests, externalGuests]);

  // Check if this session is tracked
  const sessionTracked = isSessionTracked(eventId, sessionId);
  const trackedGuestIds = getTrackedGuests(eventId);

  // Calculate adjacency history for tracked guests
  // Now filtered to show only opposite guest type with adjacency type breakdown
  const adjacencyHistory = useMemo(() => {
    if (!sessionTracked || trackedGuestIds.length === 0) {
      return [];
    }

    return trackedGuestIds.map(trackedGuestId => {
      const guest = guestLookup[trackedGuestId];
      if (!guest) return null;

      // Get filtered historical adjacency (only opposite guest type)
      // If tracked is host, shows external guests; if tracked is external, shows host guests
      const history = getFilteredTrackedGuestHistory(
        eventId, 
        sessionId, 
        trackedGuestId,
        guest.fromHost
      );

      // Convert to array with guest details and adjacency type breakdown
      const adjacencies = history
        .map(item => ({
          guestId: item.guestId,
          guest: guestLookup[item.guestId],
          count: item.count,
          byType: item.byType || {},
        }))
        .filter(a => a.guest); // Only include valid guests

      const totalAdjacencies = adjacencies.reduce((sum, a) => sum + a.count, 0);

      return {
        trackedGuestId,
        trackedGuest: guest,
        adjacencies,
        totalAdjacencies,
        uniqueGuests: adjacencies.length,
        // Info about what type of guests are shown
        showingGuestType: guest.fromHost ? 'external' : 'host',
      };
    }).filter(Boolean);
  }, [sessionTracked, trackedGuestIds, eventId, sessionId, guestLookup, getFilteredTrackedGuestHistory]);

  // Calculate CURRENT session adjacencies (what would be recorded when saving)
  // This shows users what's being tracked right now without navigating to next session
  const currentSessionAdjacencies = useMemo(() => {
    if (!sessionTracked || trackedGuestIds.length === 0) {
      return [];
    }

    // Build guest-to-seat mapping
    const guestSeatMap = new Map<string, { tableId: string; seatId: string; table: any }>();
    tables.forEach(table => {
      table.seats.forEach(seat => {
        if (seat.assignedGuestId) {
          guestSeatMap.set(seat.assignedGuestId, {
            tableId: table.id,
            seatId: seat.id,
            table: table,
          });
        }
      });
    });

    return trackedGuestIds.map(trackedGuestId => {
      const trackedGuest = guestLookup[trackedGuestId];
      if (!trackedGuest) return null;

      const guestSeatData = guestSeatMap.get(trackedGuestId);
      if (!guestSeatData) {
        // Tracked guest is not seated in this session
        return {
          trackedGuestId,
          trackedGuest,
          isSeated: false,
          adjacencies: [],
          totalAdjacencies: 0,
          showingGuestType: trackedGuest.fromHost ? 'external' : 'host',
        };
      }

      const { seatId, table } = guestSeatData;
      
      // Get enhanced adjacencies (side + opposite + edge for rectangle tables)
      const enhancedAdjacencies = getEnhancedAdjacentSeats(table, seatId);
      
      // Filter to only show opposite guest type and exclude locked seats
      const oppositeFromHost = !trackedGuest.fromHost; // If tracked is host, show external (fromHost=false)
      
      const adjacencies = enhancedAdjacencies
        .filter(adj => {
          const adjGuest = guestLookup[adj.guestId];
          if (!adjGuest) return false;
          // Only include guests of the opposite type
          return adjGuest.fromHost === oppositeFromHost;
        })
        .filter(adj => {
          // Exclude locked seats
          const adjSeat = table.seats.find((s: any) => s.id === adj.seatId);
          return adjSeat && !adjSeat.locked;
        })
        .map(adj => ({
          guestId: adj.guestId,
          guest: guestLookup[adj.guestId],
          adjacencyType: adj.adjacencyType,
        }));

      return {
        trackedGuestId,
        trackedGuest,
        isSeated: true,
        adjacencies,
        totalAdjacencies: adjacencies.length,
        showingGuestType: trackedGuest.fromHost ? 'external' : 'host',
      };
    }).filter(Boolean);
  }, [sessionTracked, trackedGuestIds, tables, guestLookup]);

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

    // Violations are now read directly from seatStore (reactive)
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

      proximityViolations: violations, // Use violations from store
    };
  }, [tables, hostGuests, externalGuests, violations]); // Added violations to dependencies

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
            width: 480,
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
            variant="scrollable"
            scrollButtons="auto"
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
            {sessionTracked && trackedGuestIds.length > 0 && (
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Visibility fontSize="small" />
                    Adjacency
                  </Box>
                }
                value="adjacency"
              />
            )}
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
                       {stats.totalVIPsUnseated} VIP/s Unseated
                      </Typography>
                      <Typography variant="caption">View</Typography>
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
                        {stats.proximityViolations.length} Proximity Rule Violations
                      </Typography>
                      <Typography variant="caption">View</Typography>
                    </Stack>
                  </Box>
                )}

                {/* Boss Adjacency Info */}
                {sessionTracked && trackedGuestIds.length > 0 && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: '#e3f2fd',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#2196f3', color: 'white' },
                    }}
                    onClick={() => setDetailView('adjacency')}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Visibility fontSize="small" />
                        <Typography variant="body2" fontWeight="bold">
                          Boss Adjacency Tracked
                        </Typography>
                      </Stack>
                      <Typography variant="caption">View</Typography>
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
                                  {guest.title} - {guest.company} - {guest.country}
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
                                  {guest.title} - {guest.company} - {guest.country}
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
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Run autofill with proximity rules to see violations
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* Sit Together Violations */}
                    {stats.proximityViolations.filter((v: any) => v.type === 'sit-together').length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="error" gutterBottom>
                          Sit Together Violations
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
                                  label={`${violation.tableLabel}`}
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
                          Sit Away Violations
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

            {detailView === 'adjacency' && (
              <Stack spacing={2}>
                {!sessionTracked || trackedGuestIds.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Visibility sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">
                      No tracked guests in this session
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* ==================== CURRENT SESSION TRACKLIST ==================== */}
                    <Box sx={{ 
                      bgcolor: '#e3f2fd', 
                      borderRadius: 1, 
                      p: 1.5,
                      border: '1px solid #90caf9'
                    }}>
                      <Typography variant="subtitle2" fontWeight={600} color="primary" gutterBottom>
                        Current Session Tracklist
                      </Typography>
                      {currentSessionAdjacencies.map((current: any) => (
                        <Box 
                          key={current.trackedGuestId} 
                          sx={{ 
                            bgcolor: 'white', 
                            borderRadius: 1, 
                            p: 1.5, 
                            mb: 1,
                            border: '1px solid #e0e0e0'
                          }}
                        >
                          <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                            <Visibility color="primary" fontSize="small" />
                            <Box flexGrow={1}>
                              <Typography variant="body2" fontWeight={600}>
                                {current.trackedGuest.salutation} {current.trackedGuest.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {current.trackedGuest.company} • {current.trackedGuest.fromHost ? 'Host' : 'External'}
                              </Typography>
                            </Box>
                            {!current.isSeated ? (
                              <Chip
                                label="Not Seated"
                                size="small"
                                color="default"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label={`${current.totalAdjacencies} ${current.showingGuestType}`}
                                size="small"
                                color={current.totalAdjacencies > 0 ? 'success' : 'default'}
                              />
                            )}
                          </Stack>

                          {current.isSeated && current.adjacencies.length === 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ pl: 4 }}>
                              No {current.showingGuestType} guests adjacent
                            </Typography>
                          )}

                          {current.isSeated && current.adjacencies.length > 0 && (
                            <Stack spacing={0.5} sx={{ pl: 4 }}>
                              {current.adjacencies.map((adj: any) => (
                                <Stack 
                                  key={adj.guestId} 
                                  direction="row" 
                                  spacing={1} 
                                  alignItems="center"
                                  sx={{ 
                                    bgcolor: '#f5f5f5', 
                                    borderRadius: 0.5, 
                                    px: 1, 
                                    py: 0.5 
                                  }}
                                >
                                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                    {adj.guest.salutation} {adj.guest.name}
                                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                      {adj.guest.company}
                                    </Typography>
                                  </Typography>
                                  <Chip
                                    label={adj.adjacencyType === 'side' ? 'Side' : adj.adjacencyType === 'opposite' ? 'Opposite' : 'Edge'}
                                    size="small"
                                    color={adj.adjacencyType === 'opposite' ? 'info' : adj.adjacencyType === 'edge' ? 'secondary' : 'default'}
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 18 }}
                                  />
                                </Stack>
                              ))}
                            </Stack>
                          )}
                        </Box>
                      ))}
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* ==================== HISTORICAL ADJACENCY DATA ==================== */}
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Historical Adjacency
                    </Typography>
                    {adjacencyHistory.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          No historical adjacency data yet
                        </Typography>
                      </Box>
                    ) : (
                      adjacencyHistory.map((history: any) => (
                        <Accordion key={history.trackedGuestId} defaultExpanded={adjacencyHistory.length === 1}>
                          <AccordionSummary expandIcon={<ExpandMore />}>
                            <Stack direction="row" spacing={2} alignItems="center" width="100%">
                              <Visibility color="primary" fontSize="small" />
                              <Box flexGrow={1}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {history.trackedGuest.salutation} {history.trackedGuest.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {history.trackedGuest.company} • {history.trackedGuest.fromHost ? 'Host' : 'External'}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  label={`${history.uniqueGuests} ${history.showingGuestType}`}
                                  size="small"
                                  color={history.showingGuestType === 'external' ? 'error' : 'primary'}
                                  variant="outlined"
                                />
                                <Chip
                                  label={`${history.totalAdjacencies} total`}
                                  size="small"
                                  color="default"
                                />
                              </Stack>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails>
                            {history.adjacencies.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" align="center" py={2}>
                                No previous adjacencies with {history.showingGuestType} guests recorded
                              </Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Guest</TableCell>
                                    <TableCell>Company</TableCell>
                                    <TableCell align="center">Total</TableCell>
                                    <TableCell align="center">Type</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {history.adjacencies.map((adj: any) => (
                                    <TableRow
                                      key={adj.guestId}
                                      sx={{
                                        bgcolor: adj.count >= 3 ? '#ffebee' : adj.count >= 2 ? '#fff3e0' : 'transparent',
                                      }}
                                    >
                                      <TableCell>
                                        <Typography variant="body2" fontWeight={500}>
                                          {adj.guest.salutation} {adj.guest.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {adj.guest.title}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Typography variant="body2">
                                          {adj.guest.company}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Chip
                                          label={`${adj.count}x`}
                                          size="small"
                                          color={adj.count >= 3 ? 'error' : adj.count >= 2 ? 'warning' : 'default'}
                                        />
                                      </TableCell>
                                      <TableCell align="center">
                                        <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap">
                                          {adj.byType?.side > 0 && (
                                            <Chip
                                              label={`Side: ${adj.byType.side}`}
                                              size="small"
                                              variant="outlined"
                                              sx={{ fontSize: '0.65rem', height: 18 }}
                                            />
                                          )}
                                          {adj.byType?.opposite > 0 && (
                                            <Chip
                                              label={`Opp: ${adj.byType.opposite}`}
                                              size="small"
                                              color="info"
                                              variant="outlined"
                                              sx={{ fontSize: '0.65rem', height: 18 }}
                                            />
                                          )}
                                          {adj.byType?.edge > 0 && (
                                            <Chip
                                              label={`Edge: ${adj.byType.edge}`}
                                              size="small"
                                              color="secondary"
                                              variant="outlined"
                                              sx={{ fontSize: '0.65rem', height: 18 }}
                                            />
                                          )}
                                        </Stack>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </AccordionDetails>
                        </Accordion>
                      ))
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