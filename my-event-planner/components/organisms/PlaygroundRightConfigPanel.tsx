'use client';

import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Stack,
} from '@mui/material';
import { useState } from 'react';

export default function PlaygroundRightConfigPanel() {
  const [shape, setShape] = useState('Round');
  const [seats, setSeats] = useState(8);
  const [label, setLabel] = useState('');

  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        width: 320,
        p: 3,
        borderLeft: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Typography variant="h6" fontWeight="medium">
        Configuration
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel>Table Shape</InputLabel>
        <Select
          value={shape}
          label="Table Shape"
          onChange={(e) => setShape(e.target.value)}
        >
          <MenuItem value="Round">Round</MenuItem>
          <MenuItem value="Square">Square</MenuItem>
          <MenuItem value="Rectangle">Rectangle</MenuItem>
        </Select>
      </FormControl>

      <TextField
        label="Seats per Table"
        type="number"
        value={seats}
        onChange={(e) => setSeats(Number(e.target.value))}
        inputProps={{ min: 1, max: 20 }}
        size="small"
        fullWidth
      />

      <TextField
        label="Table Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. VIP Table A"
        size="small"
        fullWidth
      />

      <Box flexGrow={1} />

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={() =>
            console.log('Apply config:', { shape, seats, label })
          }
        >
          Apply
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          fullWidth
          onClick={() => {
            setShape('Round');
            setSeats(8);
            setLabel('');
          }}
        >
          Reset
        </Button>
      </Stack>
    </Paper>
  );
}
