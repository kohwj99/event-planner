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
} from '@mui/material';
import { useGuestStore } from '@/store/guestStore';

interface Props {
  open: boolean;
  onClose: () => void;
  tableId: string | null;
  seatId: string | null;
  onConfirm?: (guestId: string | null) => void;
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
  const [filter, setFilter] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFilter('');
      setSelectedGuestId(null);
    }
  }, [open]);

  const combined = useMemo(
    () => [...hostGuests, ...externalGuests],
    [hostGuests, externalGuests]
  );

  const visible = combined.filter(
    (g) =>
      !g.deleted &&
      `${g.name} ${g.company} ${g.title}`
        .toLowerCase()
        .includes(filter.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Guest</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Table: {tableId ?? '-'} • Seat: {seatId ?? '-'}
        </Typography>

        <TextField
          placeholder="Search by name, company or title"
          fullWidth
          size="small"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ mb: 1 }}
        />

        <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedGuestId === null}
              onClick={() => setSelectedGuestId(null)}
            >
              <ListItemText primary="— Unassign / Clear seat —" />
            </ListItemButton>
          </ListItem>

          {visible.map((g) => (
            <ListItem key={g.id} disablePadding>
              <ListItemButton
                selected={selectedGuestId === g.id}
                onClick={() => setSelectedGuestId(g.id)}
              >
                <ListItemText
                  primary={g.name}
                  secondary={`${g.title} — ${g.company}`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            onConfirm?.(selectedGuestId);
            onClose();
          }}
        >
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}
