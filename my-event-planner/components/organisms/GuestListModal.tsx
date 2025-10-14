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
} from '@mui/material';
import { useState, useMemo } from 'react';
import { useGuestStore, Guest } from '@/store/guestStore';
import { Delete, Restore, Search } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

// TODO refactor
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
  const { hostGuests, externalGuests, addGuest, toggleDeleted } = useGuestStore();

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

  // Filtered guests list
  const filteredGuests = useMemo(() => {
    if (!filter.trim()) return guests;
    const q = filter.toLowerCase();
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.company.toLowerCase().includes(q) ||
        g.title.toLowerCase().includes(q) ||
        g.country.toLowerCase().includes(q)
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Manage Guest Lists</DialogTitle>
      <DialogContent dividers sx={{ bgcolor: '#fafafa' }}>
        {/* Tabs */}
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
            // sx={{ width: 120 }}
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
            // sx={{ flex: 1, minWidth: 180 }}
          />

          <TextField
            label="Gender"
            select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as Guest['gender'] })}
            // sx={{ width: 140 }}
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
            // sx={{ width: 180 }}
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
            // sx={{ minWidth: 180 }}
          />

          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            // sx={{ minWidth: 160 }}
          />

          <TextField
            label="Ranking"
            type="number"
            value={form.ranking}
            onChange={(e) =>
              setForm({ ...form, ranking: Math.min(10, Math.max(1, Number(e.target.value))) })
            }
            // sx={{ width: 120 }}
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
            sx={{ width: 260 }}
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
            maxHeight: 340,
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
            filteredGuests.map((g) => (
              <Stack
                key={g.id}
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{
                  p: 1.2,
                  borderBottom: '1px solid #eee',
                  bgcolor: g.deleted ? '#f5f5f5' : 'white',
                  opacity: g.deleted ? 0.5 : 1,
                }}
              >
                <Typography sx={{ width: 80 }}>{g.salutation}</Typography>
                <Typography sx={{ width: 180 }}>{g.name}</Typography>
                <Typography sx={{ width: 120 }}>{g.gender}</Typography>
                <Typography sx={{ width: 160 }}>{g.company}</Typography>
                <Typography sx={{ width: 160 }}>{g.title}</Typography>
                <Typography sx={{ width: 90 }}>Rank {g.ranking}</Typography>
                <Typography sx={{ width: 100 }}>{g.country}</Typography>

                <Box flexGrow={1} />

                <IconButton
                  size="small"
                  onClick={() => toggleDeleted(g.id, fromHost)}
                  color={g.deleted ? 'success' : 'error'}
                >
                  {g.deleted ? <Restore /> : <Delete />}
                </IconButton>
              </Stack>
            ))
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
