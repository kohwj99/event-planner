import { useMemo } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Alert,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore,
  Warning,
  CheckCircle,
  Visibility,
  Info,
} from '@mui/icons-material';
import { useTrackingStore } from '@/store/trackingStore';
import { useGuestStore } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import { validateSeatingAgainstHistory } from '@/utils/trackingHelper';

interface AdjacencyWarningPanelProps {
  eventId: string;
  sessionId: string;
  threshold?: number; // Default: 2 times
}

export default function AdjacencyWarningPanel({
  eventId,
  sessionId,
  threshold = 2,
}: AdjacencyWarningPanelProps) {
  const isSessionTracked = useTrackingStore((s) => s.isSessionTracked);
  const getTrackedGuests = useTrackingStore((s) => s.getTrackedGuests);
  const getHistoricalAdjacencyCount = useTrackingStore((s) => s.getHistoricalAdjacencyCount);
  
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const tables = useSeatStore((s) => s.tables);

  const allGuests = useMemo(() => [...hostGuests, ...externalGuests], [hostGuests, externalGuests]);
  const guestMap = useMemo(() => new Map(allGuests.map(g => [g.id, g])), [allGuests]);

  // Check if this session is tracked
  const tracked = isSessionTracked(eventId, sessionId);
  const trackedGuestIds = getTrackedGuests(eventId);

  // Build current adjacency map from tables
  const currentAdjacencies = useMemo(() => {
    const adjacencyMap = new Map<string, string[]>();

    if (!tracked || trackedGuestIds.length === 0) return adjacencyMap;

    // For each tracked guest, find their current adjacent seats
    const guestSeatMap = new Map<string, any>();
    tables.forEach(table => {
      table.seats.forEach(seat => {
        if (seat.assignedGuestId) {
          guestSeatMap.set(seat.assignedGuestId, seat);
        }
      });
    });

    trackedGuestIds.forEach(trackedGuestId => {
      const seat = guestSeatMap.get(trackedGuestId);
      if (!seat || !seat.adjacentSeats) return;

      const adjacentGuestIds: string[] = [];
      
      seat.adjacentSeats.forEach((adjacentSeatId: string) => {
        // Find the adjacent seat
        for (const table of tables) {
          const adjacentSeat = table.seats.find(s => s.id === adjacentSeatId);
          if (adjacentSeat?.assignedGuestId && !adjacentSeat.locked) {
            adjacentGuestIds.push(adjacentSeat.assignedGuestId);
            break;
          }
        }
      });

      if (adjacentGuestIds.length > 0) {
        adjacencyMap.set(trackedGuestId, adjacentGuestIds);
      }
    });

    return adjacencyMap;
  }, [tracked, trackedGuestIds, tables]);

  // Validate current seating against history
  const warnings = useMemo(() => {
    if (!tracked || currentAdjacencies.size === 0) return [];
    return validateSeatingAgainstHistory(eventId, sessionId, currentAdjacencies, threshold);
  }, [tracked, eventId, sessionId, currentAdjacencies, threshold]);

  const violationWarnings = warnings.filter(w => w.violation);
  const infoWarnings = warnings.filter(w => !w.violation);

  if (!tracked) {
    return null;
  }

  if (trackedGuestIds.length === 0) {
    return (
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#fff3e0', borderLeft: '4px solid #ff9800' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Info color="warning" />
          <Typography variant="body2">
            This session is tracked, but no guests are marked for Boss Adjacency tracking.
            Mark guests in the Master Guest List to enable analysis.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ mb: 2 }}>
      <Accordion defaultExpanded={violationWarnings.length > 0}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" spacing={2} alignItems="center" width="100%">
            <Visibility color="primary" />
            <Box flexGrow={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Boss Adjacency Analysis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tracking {trackedGuestIds.length} guest{trackedGuestIds.length !== 1 ? 's' : ''} | 
                Threshold: {threshold} previous adjacenc{threshold !== 1 ? 'ies' : 'y'}
              </Typography>
            </Box>
            {violationWarnings.length > 0 ? (
              <Chip
                icon={<Warning />}
                label={`${violationWarnings.length} Warning${violationWarnings.length !== 1 ? 's' : ''}`}
                color="error"
                size="small"
              />
            ) : (
              <Chip
                icon={<CheckCircle />}
                label="All Clear"
                color="success"
                size="small"
              />
            )}
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          {currentAdjacencies.size === 0 ? (
            <Alert severity="info" icon={<Info />}>
              No tracked guests are currently seated. Assign seats to see adjacency analysis.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {/* Violations */}
              {violationWarnings.length > 0 && (
                <Box>
                  <Alert severity="error" icon={<Warning />} sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Threshold Exceeded
                    </Typography>
                    <Typography variant="caption">
                      The following tracked guests are seated next to guests they've sat with {threshold}+ times before:
                    </Typography>
                  </Alert>

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tracked Guest</TableCell>
                        <TableCell>Adjacent Guest</TableCell>
                        <TableCell align="center">Previous Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {violationWarnings.map((warning, idx) => {
                        const trackedGuest = guestMap.get(warning.trackedGuestId);
                        const adjacentGuest = guestMap.get(warning.adjacentGuestId);
                        
                        return (
                          <TableRow key={idx} sx={{ bgcolor: '#ffebee' }}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {trackedGuest?.name || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {trackedGuest?.company}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {adjacentGuest?.name || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {adjacentGuest?.company}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${warning.historicalCount}x`}
                                size="small"
                                color="error"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* Info - Previous adjacencies but below threshold */}
              {infoWarnings.length > 0 && (
                <Box>
                  <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Previous Adjacencies (Below Threshold)
                    </Typography>
                    <Typography variant="caption">
                      These guests have sat together before, but haven't reached the threshold yet:
                    </Typography>
                  </Alert>

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tracked Guest</TableCell>
                        <TableCell>Adjacent Guest</TableCell>
                        <TableCell align="center">Previous Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {infoWarnings.map((warning, idx) => {
                        const trackedGuest = guestMap.get(warning.trackedGuestId);
                        const adjacentGuest = guestMap.get(warning.adjacentGuestId);
                        
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {trackedGuest?.name || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {trackedGuest?.company}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {adjacentGuest?.name || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {adjacentGuest?.company}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${warning.historicalCount}x`}
                                size="small"
                                color="default"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* All clear */}
              {warnings.length === 0 && (
                <Alert severity="success" icon={<CheckCircle />}>
                  No previous adjacencies detected. This seating arrangement introduces new connections.
                </Alert>
              )}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}