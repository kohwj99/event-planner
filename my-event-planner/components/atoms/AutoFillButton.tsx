// /components/atoms/AutoFillButton.tsx
'use client';

import { useState } from 'react';
import { Button } from '@mui/material';
import AutoFillModal from '@/components/molecules/AutoFillModal';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useEventStore } from '@/store/eventStore';

export default function AutoFillButton() {
  const [open, setOpen] = useState(false);
  const activeEventId = useEventStore((s) => s.activeEventId);
  const activeSessionId = useEventStore((s) => s.activeSessionId);

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        onClick={() => setOpen(true)}
        startIcon={<AutoAwesomeIcon />}
      >
        AutoFill
      </Button>

      <AutoFillModal 
        open={open} 
        onClose={() => setOpen(false)} 
        eventId={activeEventId}
        sessionId={activeSessionId}
      />
    </>
  );
}