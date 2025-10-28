// /components/atoms/AutoFillButton.tsx
'use client';

import { useState } from 'react';
import { Button } from '@mui/material';
import AutoFillModal from '@/components/molecules/AutoFillModal';

export default function AutoFillButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        onClick={() => setOpen(true)}
      >
        Auto-Fill Seats
      </Button>

      <AutoFillModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
