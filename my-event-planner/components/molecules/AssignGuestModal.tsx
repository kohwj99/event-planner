'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
  Alert,
  Divider,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Search,
  Home,
  PersonOutline,
  Block,
  CheckCircle,
} from '@mui/icons-material';
import { useGuestStore } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import { SeatMode, SEAT_MODE_CONFIGS } from '@/types/Seat';
import { partitionGuestsBySeatMode, getSeatModeIncompatibilityReason } from '@/utils/seatValidation';

interface Props {
  open: boolean;
  onClose: () => void;
  tableId: string | null;
  seatId: string | null;
  onConfirm?: (guestId: string | null) => void;
}

// Helper to get seat mode display info
function getSeatModeDisplay(mode: SeatMode) {
  const config = SEAT_MODE_CONFIGS[mode] || SEAT_MODE_CONFIGS['default'];
  return {
    label: config.label,
    shortLabel: config.shortLabel,
    description: config.description,
    color: config.color,
    icon: mode === 'host-only' ? <Home fontSize="small" /> : mode === 'external-only' ? <PersonOutline fontSize="small" /> : null,
    chipColor: mode === 'host-only' ? 'primary' : mode === 'external-only' ? 'error' : 'default',
  };
}

export default function AssignGuestModal({
  open,
  onClose,
  tableId,
  seatId,
  onConfirm,
}: Props) {
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const tables = useSeatStore((s) => s.tables);
  
  const [filter, setFilter] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [showIncompatible, setShowIncompatible] = useState(false);

  // Get the seat and its mode
  const { seat, table, seatMode } = useMemo(() => {
    if (!tableId || !seatId) {
      return { seat: null, table: null, seatMode: 'default' as SeatMode };
    }
    const foundTable = tables.find((t) => t.id === tableId);
    const foundSeat = foundTable?.seats.find((s) => s.id === seatId);
    return {
      seat: foundSeat,
      table: foundTable,
      seatMode: (foundSeat?.mode || 'default') as SeatMode,
    };
  }, [tables, tableId, seatId]);

  const seatModeDisplay = getSeatModeDisplay(seatMode);

  useEffect(() => {
    if (!open) {
      setFilter('');
      setSelectedGuestId(null);
      setShowIncompatible(false);
    }
  }, [open]);

  // Combine all guests
  const allGuests = useMemo(
    () => [...hostGuests, ...externalGuests].filter((g) => !g.deleted),
    [hostGuests, externalGuests]
  );

  // Filter by search query
  const filteredGuests = useMemo(() => {
    if (!filter.trim()) return allGuests;
    const query = filter.toLowerCase();
    return allGuests.filter((g) =>
      `${g.name} ${g.company} ${g.title}`.toLowerCase().includes(query)
    );
  }, [allGuests, filter]);

  // Partition into compatible and incompatible based on seat mode
  const { compatible, incompatible } = useMemo(
    () => partitionGuestsBySeatMode(filteredGuests, seatMode),
    [filteredGuests, seatMode]
  );

  // Handle confirm with validation feedback
  const handleConfirm = () => {
    if (selectedGuestId !== null) {
      // Check if selected guest is in incompatible list
      const isIncompatible = incompatible.some((g) => g.id === selectedGuestId);
      if (isIncompatible) {
        // This shouldn't happen with proper UI, but just in case
        alert('Cannot assign this guest to this seat due to seat mode restrictions.');
        return;
      }
    }
    
    onConfirm?.(selectedGuestId);
    onClose();
  };

  const renderGuestItem = (guest: any, isDisabled: boolean = false) => {
    const isSelected = selectedGuestId === guest.id;
    const incompatibilityReason = isDisabled 
      ? getSeatModeIncompatibilityReason(seatMode, guest.fromHost)
      : null;

    return (
      <ListItem key={guest.id} disablePadding sx={{ mb: 0.5 }}>
        <Tooltip 
          title={incompatibilityReason || ''} 
          placement="left"
          disableHoverListener={!isDisabled}
        >
          <ListItemButton
            selected={isSelected && !isDisabled}
            onClick={() => !isDisabled && setSelectedGuestId(guest.id)}
            disabled={isDisabled}
            sx={{
              borderRadius: 1,
              border: isSelected && !isDisabled ? '2px solid #1976d2' : '1px solid transparent',
              bgcolor: isDisabled ? '#f5f5f5' : isSelected ? '#e3f2fd' : 'transparent',
              opacity: isDisabled ? 0.6 : 1,
              '&:hover': {
                bgcolor: isDisabled ? '#f5f5f5' : '#e3f2fd',
              },
            }}
          >
            <ListItemText
              primary={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography 
                    variant="body1" 
                    fontWeight={isSelected && !isDisabled ? 600 : 400}
                    color={isDisabled ? 'text.disabled' : 'text.primary'}
                  >
                    {guest.name}
                  </Typography>
                  <Chip
                    label={guest.fromHost ? 'Host' : 'External'}
                    size="small"
                    color={guest.fromHost ? 'primary' : 'success'}
                    variant={isDisabled ? 'outlined' : 'filled'}
                    sx={{ height: 20, fontSize: 10 }}
                  />
                  {isDisabled && (
                    <Chip
                      label="Incompatible"
                      size="small"
                      icon={<Block fontSize="small" />}
                      sx={{ 
                        height: 20, 
                        fontSize: 10, 
                        bgcolor: '#ffebee', 
                        color: '#c62828',
                        '& .MuiChip-icon': { color: '#c62828' }
                      }}
                    />
                  )}
                </Stack>
              }
              secondary={
                <Typography 
                  variant="caption" 
                  color={isDisabled ? 'text.disabled' : 'text.secondary'}
                >
                  {guest.title} — {guest.company}
                </Typography>
              }
            />
          </ListItemButton>
        </Tooltip>
      </ListItem>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Assign Guest</Typography>
          {seatMode !== 'default' && (
            <Chip
              label={seatModeDisplay.label}
              color={seatModeDisplay.chipColor as 'primary' | 'error' | 'default'}
              icon={seatModeDisplay.icon || undefined}
              size="small"
            />
          )}
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={2}>
          {/* Seat Info */}
          <Box>
            <Typography variant="body2" color="text.secondary">
              {table?.label || 'Table'} • Seat {seat?.seatNumber || '-'}
            </Typography>
          </Box>

          {/* Seat Mode Alert */}
          {seatMode !== 'default' && (
            <Alert 
              severity="info" 
              icon={seatModeDisplay.icon}
              sx={{ py: 0.5 }}
            >
              <Typography variant="body2">
                <strong>Seat restriction:</strong> {seatModeDisplay.description}
              </Typography>
            </Alert>
          )}

          {/* Search */}
          <TextField
            placeholder="Search by name, company or title"
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
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" color="text.secondary">
              {compatible.length} compatible guest{compatible.length !== 1 ? 's' : ''}
            </Typography>
            {incompatible.length > 0 && (
              <Chip
                label={`${incompatible.length} incompatible`}
                size="small"
                sx={{ bgcolor: '#ffebee', color: '#c62828', height: 20, fontSize: 10 }}
              />
            )}
          </Stack>

          {/* Guest List */}
          <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
            {/* Unassign Option */}
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                selected={selectedGuestId === null}
                onClick={() => setSelectedGuestId(null)}
                sx={{
                  borderRadius: 1,
                  border: selectedGuestId === null ? '2px solid #1976d2' : '1px solid #e0e0e0',
                  bgcolor: selectedGuestId === null ? '#e3f2fd' : '#fafafa',
                }}
              >
                <ListItemText 
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body1" fontWeight={selectedGuestId === null ? 600 : 400}>
                        — Unassign / Clear seat —
                      </Typography>
                      {selectedGuestId === null && (
                        <CheckCircle fontSize="small" color="primary" />
                      )}
                    </Stack>
                  }
                />
              </ListItemButton>
            </ListItem>

            <Divider sx={{ my: 1 }} />

            {/* Compatible Guests */}
            {compatible.length > 0 && (
              <>
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ px: 1, display: 'block', mb: 0.5 }}
                >
                  Compatible Guests
                </Typography>
                {compatible.map((g) => renderGuestItem(g, false))}
              </>
            )}

            {compatible.length === 0 && incompatible.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No guests found matching your search.
              </Typography>
            )}

            {compatible.length === 0 && incompatible.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                No compatible guests found. All {incompatible.length} guest{incompatible.length !== 1 ? 's are' : ' is'} incompatible 
                with this seat's {seatMode === 'host-only' ? 'host-only' : 'external-only'} restriction.
              </Alert>
            )}

            {/* Incompatible Guests (Collapsible) */}
            {incompatible.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Button
                  size="small"
                  onClick={() => setShowIncompatible(!showIncompatible)}
                  sx={{ color: 'text.secondary', textTransform: 'none', mb: 0.5 }}
                >
                  {showIncompatible ? 'Hide' : 'Show'} {incompatible.length} incompatible guest{incompatible.length !== 1 ? 's' : ''}
                </Button>
                
                {showIncompatible && (
                  <Box sx={{ opacity: 0.7 }}>
                    {incompatible.map((g) => renderGuestItem(g, true))}
                  </Box>
                )}
              </>
            )}
          </List>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selectedGuestId !== null && incompatible.some((g) => g.id === selectedGuestId)}
        >
          {selectedGuestId === null ? 'Clear Seat' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}