'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  InputAdornment,
  Checkbox,
  Chip,
  Alert,
  FormControlLabel,
} from '@mui/material';
import { useState, useMemo, useEffect } from 'react';
import { Search, CheckCircle, Circle, Groups } from '@mui/icons-material';
import { useEventStore } from '@/store/eventStore';
import { Guest } from '@/store/guestStore';

interface SessionGuestListModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  dayId: string;
  sessionId: string;
  sessionName: string;
}

export default function SessionGuestListModal({
  open,
  onClose,
  eventId,
  dayId,
  sessionId,
  sessionName,
}: SessionGuestListModalProps) {
  const event = useEventStore((s) => s.events.find(e => e.id === eventId));
  const setSessionGuests = useEventStore((s) => s.setSessionGuests);

  const [tab, setTab] = useState<'host' | 'external'>('host');
  const [filter, setFilter] = useState('');
  const [selectedHostIds, setSelectedHostIds] = useState<Set<string>>(new Set());
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());
  const [selectAllHost, setSelectAllHost] = useState(false);
  const [selectAllExternal, setSelectAllExternal] = useState(false);

  // Load existing session guests when modal opens
  useEffect(() => {
    if (open && event) {
      const session = event.days
        .find(d => d.id === dayId)
        ?.sessions.find(s => s.id === sessionId);
      
      if (session) {
        setSelectedHostIds(new Set(session.inheritedHostGuestIds || []));
        setSelectedExternalIds(new Set(session.inheritedExternalGuestIds || []));
        
        // Check if all are selected
        setSelectAllHost(
          session.inheritedHostGuestIds?.length === event.masterHostGuests.length &&
          event.masterHostGuests.length > 0
        );
        setSelectAllExternal(
          session.inheritedExternalGuestIds?.length === event.masterExternalGuests.length &&
          event.masterExternalGuests.length > 0
        );
      }
    }
  }, [open, event, dayId, sessionId]);

  if (!event) return null;

  const masterGuests = tab === 'host' ? event.masterHostGuests : event.masterExternalGuests;
  const selectedIds = tab === 'host' ? selectedHostIds : selectedExternalIds;
  const setSelectedIds = tab === 'host' ? setSelectedHostIds : setSelectedExternalIds;

  const filteredGuests = useMemo(() => {
    if (!filter.trim()) return masterGuests;
    const q = filter.toLowerCase();
    return masterGuests.filter(
      (g) =>
        (g.name ?? '').toLowerCase().includes(q) ||
        (g.company ?? '').toLowerCase().includes(q) ||
        (g.title ?? '').toLowerCase().includes(q) ||
        (g.country ?? '').toLowerCase().includes(q)
    );
  }, [filter, masterGuests]);

  const handleToggleGuest = (guestId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(guestId)) {
      newSet.delete(guestId);
    } else {
      newSet.add(guestId);
    }
    setSelectedIds(newSet);

    // Update select all checkbox
    if (tab === 'host') {
      setSelectAllHost(newSet.size === event.masterHostGuests.length);
    } else {
      setSelectAllExternal(newSet.size === event.masterExternalGuests.length);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (tab === 'host') {
      if (checked) {
        setSelectedHostIds(new Set(event.masterHostGuests.map(g => g.id)));
      } else {
        setSelectedHostIds(new Set());
      }
      setSelectAllHost(checked);
    } else {
      if (checked) {
        setSelectedExternalIds(new Set(event.masterExternalGuests.map(g => g.id)));
      } else {
        setSelectedExternalIds(new Set());
      }
      setSelectAllExternal(checked);
    }
  };

  const handleSave = () => {
    setSessionGuests(
      eventId,
      dayId,
      sessionId,
      Array.from(selectedHostIds),
      Array.from(selectedExternalIds)
    );
    onClose();
  };

  const totalSelected = selectedHostIds.size + selectedExternalIds.size;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Box>
          <Typography variant="h6">Manage Session Attendees</Typography>
          <Typography variant="body2" color="text.secondary">
            {sessionName}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#fafafa' }}>
        <Alert severity="info" sx={{ mb: 2 }} icon={<Groups />}>
          Select guests from the master guest lists to attend this session. You can select all guests or a subset.
        </Alert>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab 
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <span>Host Company</span>
                <Chip 
                  label={`${selectedHostIds.size}/${event.masterHostGuests.length}`} 
                  size="small" 
                  color={selectedHostIds.size > 0 ? "primary" : "default"}
                />
              </Box>
            } 
            value="host" 
          />
          <Tab 
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <span>External Guests</span>
                <Chip 
                  label={`${selectedExternalIds.size}/${event.masterExternalGuests.length}`} 
                  size="small" 
                  color={selectedExternalIds.size > 0 ? "primary" : "default"}
                />
              </Box>
            } 
            value="external" 
          />
        </Tabs>

        {/* Controls */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={tab === 'host' ? selectAllHost : selectAllExternal}
                onChange={(e) => handleSelectAll(e.target.checked)}
                indeterminate={
                  selectedIds.size > 0 && selectedIds.size < masterGuests.length
                }
              />
            }
            label={<Typography variant="body2" fontWeight={600}>Select All</Typography>}
          />
          
          <TextField
            size="small"
            placeholder="Search guests..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        {/* Guest List */}
        {masterGuests.length === 0 ? (
          <Box 
            sx={{ 
              p: 6, 
              bgcolor: 'white', 
              borderRadius: 1, 
              border: '1px solid #ddd',
              textAlign: 'center' 
            }}
          >
            <Typography color="text.secondary">
              No {tab === 'host' ? 'host' : 'external'} guests in master list.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Add guests to the master list first.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              maxHeight: 500,
              overflowY: 'auto',
              bgcolor: 'white',
              borderRadius: 1,
              border: '1px solid #ddd',
            }}
          >
            {filteredGuests.length === 0 ? (
              <Typography align="center" py={4} color="text.secondary">
                No matching guests found.
              </Typography>
            ) : (
              filteredGuests.map((guest) => {
                const isSelected = selectedIds.has(guest.id);

                return (
                  <Stack
                    key={guest.id}
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{
                      p: 2,
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      bgcolor: isSelected ? '#f0f7ff' : 'white',
                      '&:hover': {
                        bgcolor: isSelected ? '#e3f2fd' : '#f9f9f9',
                      },
                    }}
                    onClick={() => handleToggleGuest(guest.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggleGuest(guest.id)}
                      icon={<Circle />}
                      checkedIcon={<CheckCircle />}
                    />

                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 200 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {guest.salutation} {guest.name}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                      {guest.gender}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>
                      {guest.company}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>
                      {guest.title}
                    </Typography>

                    <Chip 
                      label={`Rank ${guest.ranking}`} 
                      size="small" 
                      color={guest.ranking <= 4 ? 'error' : 'default'}
                      sx={{ minWidth: 80 }}
                    />

                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      {guest.country}
                    </Typography>
                  </Stack>
                );
              })
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Total selected: <strong>{totalSelected}</strong> guest{totalSelected !== 1 ? 's' : ''}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            Save Attendees
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}