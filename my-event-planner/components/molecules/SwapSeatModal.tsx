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
} from '@mui/icons-material';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { getSwapCandidates } from '@/utils/swapHelper';
import { countViolations } from '@/utils/violationDetector';
import type { ProximityViolation } from '@/utils/violationDetector';

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
  guestId: string;
  guest: any;
  validation: {
    isValid: boolean;
    reasons: string[];
    canSwap: boolean;
  };
  violationsAfterSwap: ProximityViolation[];
  violationCount: number;
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

  // Reset selection when modal opens/closes or candidates change
  useEffect(() => {
    if (!open) return;

    setSelectedCandidate(null);
    setFilter('');
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

  // Separate perfect swaps from others
  const perfectSwaps = filteredCandidates.filter((c) => c.violationCount === 0);
  const imperfectSwaps = filteredCandidates.filter((c) => c.violationCount > 0);

  const handleSwap = () => {
    if (!selectedCandidate) return;

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
      alert('Swap failed. Please check the console for details.');
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedCandidate(null);
    setFilter('');
  };

  const renderGuestCard = (guest: any, label: string, tableLabel?: string, seatNumber?: number) => {
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
              {guest.salutation} {guest.name}
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

          <Stack direction="row" spacing={1} flexWrap="wrap">
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
          </Stack>
        </Stack>
      </Paper>
    );
  };

  const renderCandidateItem = (candidate: SwapCandidate) => {
    const isSelected = selectedCandidate?.seatId === candidate.seatId;
    const hasViolations = candidate.violationCount > 0;

    return (
      <ListItem
        key={candidate.seatId}
        disablePadding
        sx={{ mb: 1 }}
      >
        <ListItemButton
          selected={isSelected}
          onClick={() => setSelectedCandidate(candidate)}
          sx={{
            border: hasViolations ? '1px solid #ff9800' : '1px solid #4caf50',
            borderRadius: 1,
            bgcolor: hasViolations ? '#fff3e0' : '#e8f5e9',
            '&.Mui-selected': {
              bgcolor: hasViolations ? '#ffe0b2' : '#c8e6c9',
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
                  {candidate.guest?.title || ''} • {candidate.guest?.company || ''} • {candidate.guest?.country || ''}
                </Typography>
                <Stack direction="row" spacing={1}>
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
              sourceSeat?.seatNumber
            )}
          </Box>

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
              Found {filteredCandidates.length} possible swap{filteredCandidates.length !== 1 ? 's' : ''}
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
          </Stack>

          {/* Candidates List */}
          {filteredCandidates.length === 0 ? (
            <Alert severity="info">
              No valid swap candidates found. All other seats are either empty, locked, or the same seat.
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
                      ✓ Perfect Swaps (No Violations)
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
                      ⚠ Swaps with Violations
                    </Typography>
                    {imperfectSwaps.map(renderCandidateItem)}
                  </>
                )}
              </List>
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
                  selectedCandidate.seatNumber
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
                            • {v.type === 'sit-together' ? '🤝' : '🚫'} {v.guest1Name} & {v.guest2Name}
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