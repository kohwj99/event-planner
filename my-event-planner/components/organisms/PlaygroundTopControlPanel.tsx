'use client';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useGuestStore } from '@/store/guestStore';

export default function PlaygroundTopControlPanel() {
  const { resetGuests } = useGuestStore();

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="h6" fontWeight="bold">
          Seat Planner Playground
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button variant="contained" color="primary">
            New Plan
          </Button>
          <Button variant="contained" color="success">
            Import Excel
          </Button>
          <Button variant="contained" color="secondary">
            Export PDF
          </Button>
          <Button variant="contained" color="warning">
            Export PPT
          </Button>
          <Button variant="outlined" color="inherit" onClick={resetGuests}>
            Reset Guests
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
