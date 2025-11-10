// components/molecules/GuestListModal.tsx - ENHANCED with Table Info
'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  MenuItem,
  InputAdornment,
  Skeleton,
  Chip,
  Tooltip,
} from '@mui/material';
import { useState, useMemo } from 'react';
import { useGuestStore, Guest } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import { Delete, Restore, Search, EventSeat, TableRestaurant } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

const salutations = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];
const genders = ['Male', 'Female', 'Other'];
const countries = ['Singapore', 'USA', 'UK', 'China', 'India', 'Japan', 'Australia'];

export default function GuestListModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const hostGuests = useGuestStore((s) => s.hostGuests);
  const externalGuests = useGuestStore((s) => s.externalGuests);
  const addGuest = useGuestStore((s) => s.addGuest);
  const toggleDeleted = useGuestStore((s) => s.toggleDeleted);

  const tables = useSeatStore((s) => s.tables);

  const [tab, setTab] = useState<'host' | 'external'>('host');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState<Omit<Guest, 'id' | 'fromHost'>>({
    name: '',
    gender: 'Male',
    salutation: 'Mr.',
    country: 'Singapore',
    company: '',
    title: '',
    ranking: 10,
  });

  const guests = tab === 'host' ? hostGuests : externalGuests;
  const fromHost = tab === 'host';

  // NEW: Build a map of guestId -> table info
  const guestSeatingInfo = useMemo(() => {
    const info = new Map<string, { tableId: string; tableLabel: string; seatId: string; seatNumber: number }>();
    
    for (const table of tables) {
      if (!table?.seats) continue;
      for (const seat of table.seats) {
        if (seat?.assignedGuestId) {
          info.set(seat.assignedGuestId, {
            tableId: table.id,
            tableLabel: table.label,
            seatId: seat.id,
            seatNumber: seat.seatNumber,
          });
        }
      }
    }
    
    return info;
  }, [tables]);

  const filteredGuests = useMemo(() => {
    if (!filter.trim()) return guests;
    const q = filter.toLowerCase();
    return guests.filter(
      (g) =>
        (g.name ?? '').toLowerCase().includes(q) ||
        (g.company ?? '').toLowerCase().includes(q) ||
        (g.title ?? '').toLowerCase().includes(q) ||
        (g.country ?? '').toLowerCase().includes(q)
    );
  }, [filter, guests]);

  const handleAddGuest = () => {
    if (!form.name.trim()) return;
    addGuest({ ...form, id: uuidv4(), fromHost });
    setForm({
      name: '',
      gender: 'Male',
      salutation: 'Mr.',
      country: 'Singapore',
      company: '',
      title: '',
      ranking: 10,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Manage Guest Lists</DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#fafafa' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Host Company Guests" value="host" />
          <Tab label="External Guests" value="external" />
        </Tabs>

        {/* Input Form */}
        <Stack direction="row" flexWrap="wrap" spacing={2} mb={2}>
          <TextField
            label="Salutation"
            select
            value={form.salutation}
            onChange={(e) => setForm({ ...form, salutation: e.target.value })}
            sx={{ minWidth: 100 }}
          >
            {salutations.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            sx={{ minWidth: 150 }}
          />

          <TextField
            label="Gender"
            select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as Guest['gender'] })}
            sx={{ minWidth: 100 }}
          >
            {genders.map((g) => (
              <MenuItem key={g} value={g}>
                {g}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Country"
            select
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            sx={{ minWidth: 120 }}
          >
            {countries.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            sx={{ minWidth: 150 }}
          />

          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            sx={{ minWidth: 150 }}
          />

          <TextField
            label="Ranking"
            type="number"
            value={form.ranking}
            onChange={(e) =>
              setForm({ ...form, ranking: Math.min(10, Math.max(1, Number(e.target.value))) })
            }
            sx={{ minWidth: 100 }}
          />

          <Button
            variant="contained"
            onClick={handleAddGuest}
            sx={{ alignSelf: 'center', height: 56 }}
          >
            Add
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Filter bar and count */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={1}
          spacing={2}
        >
          <TextField
            size="small"
            variant="outlined"
            placeholder="Search guest..."
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
          <Typography variant="body2" color="text.secondary">
            Showing {filteredGuests.length} guest{filteredGuests.length !== 1 ? 's' : ''}
          </Typography>
        </Stack>

        {/* Guest list */}
        <Box
          sx={{
            maxHeight: 400,
            overflowY: 'auto',
            bgcolor: 'white',
            borderRadius: 1,
            border: '1px solid #ddd',
          }}
        >
          {guests.length === 0 ? (
            <Stack p={3} alignItems="center">
              <Skeleton variant="rectangular" width="80%" height={40} sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" width="60%" height={40} />
            </Stack>
          ) : filteredGuests.length === 0 ? (
            <Typography align="center" py={4} color="text.secondary">
              No matching guests found.
            </Typography>
          ) : (
            filteredGuests.map((g) => {
              const seatingInfo = guestSeatingInfo.get(g.id);
              const isSeated = !!seatingInfo;

              return (
                <Stack
                  key={g.id}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid #eee',
                    bgcolor: g.deleted ? '#f5f5f5' : 'white',
                    opacity: g.deleted ? 0.5 : 1,
                    '&:hover': {
                      bgcolor: g.deleted ? '#f5f5f5' : '#f9f9f9',
                    },
                  }}
                >
                  {/* Guest Info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 200 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {g.salutation} {g.name}
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                    {g.gender}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>
                    {g.company}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>
                    {g.title}
                  </Typography>

                  <Chip 
                    label={`Rank ${g.ranking}`} 
                    size="small" 
                    color={g.ranking <= 4 ? 'error' : 'default'}
                    sx={{ minWidth: 70 }}
                  />

                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                    {g.country}
                  </Typography>

                  <Box flexGrow={1} />

                  {/* NEW: Enhanced Seating Status */}
                  {isSeated ? (
                    <Tooltip 
                      title={`Seated at ${seatingInfo.tableLabel}, Seat ${seatingInfo.seatNumber}`}
                      arrow
                      placement="top"
                    >
                      <Chip
                        size="small"
                        color="success"
                        icon={<TableRestaurant fontSize="small" />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" fontWeight={600}>
                              {seatingInfo.tableLabel}
                            </Typography>
                            <Typography variant="caption" color="success.light">
                              •
                            </Typography>
                            <Typography variant="caption">
                              Seat {seatingInfo.seatNumber}
                            </Typography>
                          </Box>
                        }
                        sx={{ 
                          minWidth: 140,
                          cursor: 'help',
                          '& .MuiChip-label': {
                            px: 1,
                          }
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <Chip 
                      size="small" 
                      color="default" 
                      label="Unseated" 
                      icon={<EventSeat fontSize="small" />}
                      sx={{ minWidth: 140 }}
                    />
                  )}

                  <IconButton
                    size="small"
                    onClick={() => toggleDeleted(g.id, fromHost)}
                    color={g.deleted ? 'success' : 'error'}
                  >
                    {g.deleted ? <Restore /> : <Delete />}
                  </IconButton>
                </Stack>
              );
            })
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}