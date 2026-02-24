'use client';

import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import { ParsedGuest } from '@/utils/guestImportExportHelper';

interface AddGuestFormProps {
  onAdd: (guest: ParsedGuest) => void;
}

const INITIAL_FORM: ParsedGuest = {
  name: '',
  country: '',
  company: '',
  title: '',
  ranking: 10,
  mealPlans: [],
  tags: [],
};

export default function AddGuestForm({ onAdd }: AddGuestFormProps) {
  const [form, setForm] = useState<ParsedGuest>({ ...INITIAL_FORM });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    onAdd(form);
    setForm({ ...INITIAL_FORM });
  };

  return (
    <Box mb={2} p={2} bgcolor="white" borderRadius={1} border="1px solid #ddd">
      <Typography variant="subtitle2" mb={2} fontWeight={600}>
        Add New Guest
      </Typography>
      <Stack direction="row" flexWrap="wrap" spacing={1.5}>
        <TextField
          size="small"
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          sx={{ minWidth: 180 }}
        />

        <TextField
          size="small"
          label="Country"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          sx={{ minWidth: 140 }}
        />

        <TextField
          size="small"
          label="Company"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          sx={{ minWidth: 180 }}
        />

        <TextField
          size="small"
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          sx={{ minWidth: 180 }}
        />

        <TextField
          size="small"
          label="Ranking"
          type="number"
          value={form.ranking}
          onChange={(e) =>
            setForm({ ...form, ranking: Math.min(10, Math.max(0.1, Number(e.target.value))) })
          }
          inputProps={{ step: '0.1', min: '0.1', max: '10' }}
          sx={{ minWidth: 100 }}
        />

        <Button
          variant="contained"
          onClick={handleAdd}
          startIcon={<Add />}
          sx={{ height: 40 }}
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
}
