'use client';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useSeatStore } from '@/store/seatStore';
import { exportToPDF } from '@/utils/exportToPDF';
import { exportToPPTX } from '@/utils/exportToPPTX';
import { useState } from 'react';
import GuestListModal from './GuestListModal';
import AutoFillButton from '../atoms/AutoFillButton';

export default function PlaygroundTopControlPanel() {
  const { tables, resetTables } = useSeatStore();
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);

  const handleReset = () => {
    resetTables();
  }

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="h6" fontWeight="bold">
          Seat Planner
        </Typography>

        <Stack direction="row" spacing={2} p={2} bgcolor="#e3f2fd">

          <Button variant="contained" color="primary" onClick={() => setGuestModalOpen(true)}>
            Manage Guests
          </Button>

          <AutoFillButton/>

          <Button
            variant="contained"
            color="secondary"
            onClick={() => exportToPDF("playground-canvas")}
          >
            Export PDF
          </Button>

          <Button
            variant="contained"
            color="warning"
            onClick={() => exportToPPTX(tables)}
          >
            Export PPT
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={handleReset}
          >
            Reset
          </Button>

        </Stack>
      </Toolbar>

      {/* Guest List Modal */}
      <GuestListModal open={guestModalOpen} onClose={() => setGuestModalOpen(false)} />
    </AppBar>
  );
}
