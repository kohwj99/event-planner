// components/molecules/SwapSeatModal.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
  Box,
  Stack,
  Chip,
  InputAdornment,
  Alert,
  Divider,
  Paper,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  Search,
  SwapHoriz,
  Warning,
  CheckCircle,
  Close,
  Star,
  Business,
  Public,
  Block,
  ExpandMore,
  ExpandLess,
  Home,
  PersonOutline,
} from '@mui/icons-material';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { useCaptureSnapshot } from '@/components/providers/UndoRedoProvider';
import { getSwapCandidates, getIncompatibleSwapCandidates } from '@/utils/swapHelper';
import type { ProximityViolation } from '@/utils/violationDetector';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';

interface SwapSeatModalProps {
  open: boolean;
  onClose: () => void;
  sourceTableId: string;
  sourceSeatId: string;
  proximityRules?: { sitTogether: any[]; sitAway: any[] };
}

// Define the candidate type locally since we're having import issues
interface SwapCandidate {
  tableId: string;
  tableLabel: string;
  seatId: string;
  seatNumber: number;
  seatMode: SeatMode;
  guestId: string;
  guest: any;
  validation: {
    isValid: boolean;
    reasons: string[];
    canSwap: boolean;
    seatModeIssues?: {
      guest1CanSitInSeat2: boolean;
      guest2CanSitInSeat1: boolean;
      seat1Mode: SeatMode;
      seat2Mode: SeatMode;
    };
  };
  violationsAfterSwap: ProximityViolation[];
  violationCount: number;
}

interface IncompatibleCandidate {
  tableId: string;
  tableLabel: string;
  seatId: string;
  seatNumber: number;
  seatMode: SeatMode;
  sourceSeatMode: SeatMode;
  guestId: string;
  guest: any;
  seatModeValidation: {
    isCompatible: boolean;
    guest1CanSitInSeat2: boolean;
    guest2CanSitInSeat1: boolean;
    seat1Mode: SeatMode;
    seat2Mode: SeatMode;
    reasons: string[];
  };
  reasons: string[];
}

// Helper to get seat mode display info
function getSeatModeDisplay(mode: SeatMode) {
  const config = SEAT_MODE_CONFIGS[mode] || SEAT_MODE_CONFIGS['default'];
  return {
    label: config.label,
    shortLabel: config.shortLabel,
    color: config.color,
    icon: mode === 'host-only' ? <Home fontSize="small" /> : mode === 'external-only' ? <PersonOutline fontSize="small" /> : null,
    chipColor: mode === 'host-only' ? 'primary' : mode === 'external-only' ? 'error' : 'default',
  };
}

export default function SwapSeatModal({
  open,
  onClose,
  sourceTableId,
  sourceSeatId,
  proximityRules = { sitTogether: [], sitAway: [] },
}: SwapSeatModalProps) {
  const [filter, setFilter] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<SwapCandidate | null>(null);
  const [showIncompatible, setShowIncompatible] = useState(false);

  const captureSnapshot = useCaptureSnapshot();

  const tables = useSeatStore((s) => s.tables);
  const swapSeats = useSeatStore((s) => s.swapSeats);

  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const allGuests = useMemo(
    () => [...hostGuests, ...externalGuests],
    [hostGuests, externalGuests]
  );

  const guestLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    allGuests.forEach((g) => (lookup[g.id] = g));
    return lookup;
  }, [allGuests]);

  // Get source seat info
  const sourceTable = useMemo(
    () => tables.find((t) => t.id === sourceTableId),
    [tables, sourceTableId]
  );

  const sourceSeat = useMemo(
    () => sourceTable?.seats.find((s) => s.id === sourceSeatId),
    [sourceTable, sourceSeatId]
  );

  const sourceGuest = useMemo(
    () => sourceSeat?.assignedGuestId ? guestLookup[sourceSeat.assignedGuestId] : null,
    [sourceSeat, guestLookup]
  );

  const sourceSeatMode = useMemo(
    () => (sourceSeat?.mode || 'default') as SeatMode,
    [sourceSeat]
  );

  // Get swap candidates - cast the return type
  const candidates = useMemo(() => {
    if (!sourceSeat || !sourceGuest) return [];
    const result = getSwapCandidates(
      tables,
      sourceTableId,
      sourceSeatId,
      guestLookup,
      proximityRules
    );
    return result as SwapCandidate[];
  }, [tables, sourceTableId, sourceSeatId, guestLookup, proximityRules, sourceSeat, sourceGuest]);

  // Get incompatible candidates (for display purposes)
  const incompatibleCandidates = useMemo(() => {
    if (!sourceSeat || !sourceGuest) return [];
    const result = getIncompatibleSwapCandidates(
      tables,
      sourceTableId,
      sourceSeatId,
      guestLookup
    );
    return result as IncompatibleCandidate[];
  }, [tables, sourceTableId, sourceSeatId, guestLookup, sourceSeat, sourceGuest]);

  // Reset selection when modal opens/closes or candidates change
  useEffect(() => {
    if (!open) return;

    setSelectedCandidate(null);
    setFilter('');
    setShowIncompatible(false);
  }, [open]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    if (!filter.trim()) return candidates;
    const query = filter.toLowerCase();
    return candidates.filter((c) =>
      c.guest?.name?.toLowerCase().includes(query) ||
      c.guest?.company?.toLowerCase().includes(query) ||
      c.tableLabel?.toLowerCase().includes(query)
    );
  }, [candidates, filter]);

  // Filter incompatible candidates
  const filteredIncompatible = useMemo(() => {
    if (!filter.trim()) return incompatibleCandidates;
    const query = filter.toLowerCase();
    return incompatibleCandidates.filter((c) =>
      c.guest?.name?.toLowerCase().includes(query) ||
      c.guest?.company?.toLowerCase().includes(query) ||
      c.tableLabel?.toLowerCase().includes(query)
    );
  }, [incompatibleCandidates, filter]);

  // Separate perfect swaps from others
  const perfectSwaps = filteredCandidates.filter((c) => c.violationCount === 0);
  const imperfectSwaps = filteredCandidates.filter((c) => c.violationCount > 0);

  const handleSwap = () => {
    if (!selectedCandidate) return;

    captureSnapshot("Swap Seats");

    console.log('Initiating swap:', {
      source: { tableId: sourceTableId, seatId: sourceSeatId, guest: sourceGuest?.name },
      target: { tableId: selectedCandidate.tableId, seatId: selectedCandidate.seatId, guest: selectedCandidate.guest?.name }
    });

    const success = swapSeats(
      sourceTableId,
      sourceSeatId,
      selectedCandidate.tableId,
      selectedCandidate.seatId
    );

    if (success) {
      console.log('Swap completed successfully');
      onClose();
    } else {
      console.error('Swap failed');
      alert('Swap failed. The swap may violate seat mode restrictions. Please check the console for details.');
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedCandidate(null);
    setFilter('');
    setShowIncompatible(false);
  };

  const renderSeatModeChip = (mode: SeatMode, size: 'small' | 'medium' = 'small') => {
    if (mode === 'default') return null;
    
    const display = getSeatModeDisplay(mode);
    return (
      <Chip
        label={display.label}
        size={size}
        color={display.chipColor as 'primary' | 'error' | 'default'}
        variant="outlined"
        icon={display.icon || undefined}
        sx={{ height: size === 'small' ? 20 : 24, fontSize: size === 'small' ? 10 : 12 }}
      />
    );
  };

  const renderGuestCard = (guest: any, label: string, tableLabel?: string, seatNumber?: number, seatMode?: SeatMode) => {
    if (!guest) return null;

    const isVIP = guest.ranking <= 4;

    return (
      <Paper
        elevation={1}
        sx={{
          p: 2,
          bgcolor: label.includes('from') ? '#e3f2fd' : '#f5f5f5',
          border: label.includes('from') ? '2px solid #1976d2' : '1px solid #ddd',
        }}
      >
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary" fontWeight="bold">
            {label}
          </Typography>

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1" fontWeight="bold">
              {guest.name}
            </Typography>
            {isVIP && (
              <Chip
                label={`Rank ${guest.ranking}`}
                size="small"
                color="error"
                icon={<Star fontSize="small" />}
              />
            )}
          </Stack>

          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Business fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" component="span">
                {guest.company}
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Public fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" component="span">
                {guest.country}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Chip
              label={guest.fromHost ? 'Host' : 'External'}
              size="small"
              color={guest.fromHost ? 'primary' : 'success'}
            />
            {tableLabel && seatNumber && (
              <Chip
                label={`${tableLabel} - Seat ${seatNumber}`}
                size="small"
                variant="outlined"
              />
            )}
            {seatMode && seatMode !== 'default' && renderSeatModeChip(seatMode)}
          </Stack>
        </Stack>
      </Paper>
    );
  };

  const renderCandidateItem = (candidate: SwapCandidate) => {
    const isSelected = selectedCandidate?.seatId === candidate.seatId;
    const hasViolations = candidate.violationCount > 0;
    const targetSeatModeDisplay = getSeatModeDisplay(candidate.seatMode);

    return (
      <ListItem key={candidate.seatId} disablePadding sx={{ mb: 0.5 }}>
        <ListItemButton
          selected={isSelected}
          onClick={() => setSelectedCandidate(candidate)}
          sx={{
            borderRadius: 1,
            border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
            bgcolor: hasViolations ? '#fff8e1' : '#e8f5e9',
            '&.Mui-selected': {
              bgcolor: hasViolations ? '#ffecb3' : '#c8e6c9',
            },
            '&:hover': {
              bgcolor: hasViolations ? '#ffe0b2' : '#c8e6c9',
            },
          }}
        >
          <ListItemText slotProps={{ primary: { component: 'div' }, secondary: { component: 'div' } }}

            primary={
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body1" fontWeight={600}>
                    {candidate.guest?.name || 'Unknown'}
                  </Typography>
                  {candidate.guest?.ranking <= 4 && (
                    <Chip
                      label={`R${candidate.guest.ranking}`}
                      size="small"
                      color="error"
                      sx={{ height: 20 }}
                    />
                  )}
                </Stack>
                {hasViolations ? (
                  <Chip
                    label={`${candidate.violationCount} violation${candidate.violationCount > 1 ? 's' : ''}`}
                    size="small"
                    color="warning"
                    icon={<Warning fontSize="small" />}
                  />
                ) : (
                  <Chip
                    label="Perfect swap"
                    size="small"
                    color="success"
                    icon={<CheckCircle fontSize="small" />}
                  />
                )}
              </Stack>
            }
            secondary={
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="span"
                >
                  {candidate.guest?.title || ''} | {candidate.guest?.company || ''} | {candidate.guest?.country || ''}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={candidate.guest?.fromHost ? 'Host' : 'External'}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                  <Chip
                    label={`${candidate.tableLabel} - Seat ${candidate.seatNumber}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                  {candidate.seatMode !== 'default' && (
                    <Tooltip title={`This seat is restricted to ${candidate.seatMode === 'host-only' ? 'host' : 'external'} guests`}>
                      {renderSeatModeChip(candidate.seatMode) || <></>}
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
            }
          />
        </ListItemButton>
      </ListItem>
    );
  };

  const renderIncompatibleItem = (candidate: IncompatibleCandidate) => {
    return (
      <ListItem key={candidate.seatId} disablePadding sx={{ mb: 0.5 }}>
        <ListItemButton
          disabled
          sx={{
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            bgcolor: '#fafafa',
            opacity: 0.7,
            cursor: 'not-allowed',
          }}
        >
          <ListItemText slotProps={{ primary: { component: 'div' }, secondary: { component: 'div' } }}
            primary={
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body1" fontWeight={600} color="text.disabled">
                    {candidate.guest?.name || 'Unknown'}
                  </Typography>
                </Stack>
                <Chip
                  label="Seat mode incompatible"
                  size="small"
                  color="default"
                  icon={<Block fontSize="small" />}
                  sx={{ bgcolor: '#ffebee', color: '#c62828' }}
                />
              </Stack>
            }
            secondary={
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="error.main" component="span">
                  {candidate.reasons.join(' | ')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={candidate.guest?.fromHost ? 'Host' : 'External'}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                  <Chip
                    label={`${candidate.tableLabel} - Seat ${candidate.seatNumber}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                  {candidate.seatMode !== 'default' && renderSeatModeChip(candidate.seatMode)}
                </Stack>
              </Stack>
            }
          />
        </ListItemButton>
      </ListItem>
    );
  };

  if (!sourceGuest || !sourceSeat) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Alert severity="error">
            Invalid source seat or guest not found
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <SwapHoriz color="primary" />
            <Typography variant="h6">Swap Seat</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Source Guest Info */}
          <Box>
            {renderGuestCard(
              sourceGuest,
              'Swapping from:',
              sourceTable?.label,
              sourceSeat?.seatNumber,
              sourceSeatMode
            )}
          </Box>

          {/* Seat Mode Info Alert */}
          {sourceSeatMode !== 'default' && (
            <Alert severity="info" icon={sourceSeatMode === 'host-only' ? <Home /> : <PersonOutline />}>
              <Typography variant="body2">
                <strong>Source seat restriction:</strong> This seat is {sourceSeatMode === 'host-only' ? 'host-only' : 'external-only'}. 
                Only guests of the {sourceSeatMode === 'host-only' ? 'same type (host)' : 'same type (external)'} or from default seats can swap here.
              </Typography>
            </Alert>
          )}

          <Divider />

          {/* Search Filter */}
          <TextField
            placeholder="Search by name, company, or table..."
            fullWidth
            size="small"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          {/* Summary */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" color="text.secondary" component="span">
              Found {filteredCandidates.length} compatible swap{filteredCandidates.length !== 1 ? 's' : ''}
            </Typography>
            {perfectSwaps.length > 0 && (
              <Chip
                label={`${perfectSwaps.length} perfect swap${perfectSwaps.length !== 1 ? 's' : ''}`}
                size="small"
                color="success"
              />
            )}
            {imperfectSwaps.length > 0 && (
              <Chip
                label={`${imperfectSwaps.length} with violations`}
                size="small"
                color="warning"
              />
            )}
            {filteredIncompatible.length > 0 && (
              <Chip
                label={`${filteredIncompatible.length} incompatible`}
                size="small"
                color="default"
                sx={{ bgcolor: '#ffebee', color: '#c62828' }}
              />
            )}
          </Stack>

          {/* Candidates List */}
          {filteredCandidates.length === 0 && filteredIncompatible.length === 0 ? (
            <Alert severity="info">
              No valid swap candidates found. All other seats are either empty, locked, or the same seat.
            </Alert>
          ) : filteredCandidates.length === 0 && filteredIncompatible.length > 0 ? (
            <Alert severity="warning">
              No compatible swaps available. All {filteredIncompatible.length} potential swap{filteredIncompatible.length !== 1 ? 's are' : ' is'} blocked 
              due to seat mode restrictions. Consider changing seat modes or swapping with guests of compatible types.
            </Alert>
          ) : (
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              <List dense disablePadding>
                {perfectSwaps.length > 0 && (
                  <>
                    <Typography
                      variant="subtitle2"
                      color="success.main"
                      fontWeight="bold"
                      sx={{ mb: 1, px: 1 }}
                    >
                      âœ“ Perfect Swaps (No Violations)
                    </Typography>
                    {perfectSwaps.map(renderCandidateItem)}
                  </>
                )}

                {imperfectSwaps.length > 0 && (
                  <>
                    <Typography
                      variant="subtitle2"
                      color="warning.main"
                      fontWeight="bold"
                      sx={{ mt: perfectSwaps.length > 0 ? 2 : 0, mb: 1, px: 1 }}
                    >
                      âš  Swaps with Violations
                    </Typography>
                    {imperfectSwaps.map(renderCandidateItem)}
                  </>
                )}
              </List>
            </Box>
          )}

          {/* Incompatible Swaps Section (Collapsible) */}
          {filteredIncompatible.length > 0 && (
            <Box>
              <Button
                size="small"
                onClick={() => setShowIncompatible(!showIncompatible)}
                startIcon={showIncompatible ? <ExpandLess /> : <ExpandMore />}
                sx={{ color: 'text.secondary', textTransform: 'none' }}
              >
                {showIncompatible ? 'Hide' : 'Show'} {filteredIncompatible.length} incompatible swap{filteredIncompatible.length !== 1 ? 's' : ''} (seat mode restrictions)
              </Button>
              <Collapse in={showIncompatible}>
                <Box sx={{ maxHeight: 200, overflowY: 'auto', mt: 1 }}>
                  <List dense disablePadding>
                    {filteredIncompatible.map(renderIncompatibleItem)}
                  </List>
                </Box>
              </Collapse>
            </Box>
          )}

          {/* Selected Candidate Preview */}
          {selectedCandidate && (
            <>
              <Divider />
              <Box>
                {renderGuestCard(
                  selectedCandidate.guest,
                  'Swapping with:',
                  selectedCandidate.tableLabel,
                  selectedCandidate.seatNumber,
                  selectedCandidate.seatMode
                )}

                {selectedCandidate.violationCount > 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Warning: This swap will result in {selectedCandidate.violationCount} proximity violation{selectedCandidate.violationCount > 1 ? 's' : ''}
                    </Typography>
                    {selectedCandidate.violationsAfterSwap.length > 0 && (
                      <Stack spacing={0.5} sx={{ mt: 1 }}>
                        {selectedCandidate.violationsAfterSwap.slice(0, 5).map((v, idx) => (
                          <Typography key={idx} variant="caption" display="block">
                            | {v.type === 'sit-together' ? 'ðŸ¤' : 'ðŸš«'} {v.guest1Name} & {v.guest2Name}
                          </Typography>
                        ))}
                        {selectedCandidate.violationsAfterSwap.length > 5 && (
                          <Typography variant="caption" color="text.secondary">
                            ... and {selectedCandidate.violationsAfterSwap.length - 5} more
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </Alert>
                )}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSwap}
          disabled={!selectedCandidate}
          startIcon={<SwapHoriz />}
        >
          Confirm Swap
        </Button>
      </DialogActions>
    </Dialog>
  );
}