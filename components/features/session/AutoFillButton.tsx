// /components/atoms/AutoFillButton.tsx
'use client';

import { useState } from 'react';
import { Button } from '@mui/material';
import AutoFillModal from '@/components/features/session/AutoFillModal';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useEventStore } from '@/store/eventStore';

interface AutoFillButtonProps {
  disabled?: boolean; // 🆕
}

export default function AutoFillButton({ disabled = false }: AutoFillButtonProps) {
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
        disabled={disabled} // 🆕
      >
        AutoFill
      </Button>

      {/* 🆕 Only open modal if not disabled */}
      <AutoFillModal 
        open={open && !disabled} 
        onClose={() => setOpen(false)} 
        eventId={activeEventId}
        sessionId={activeSessionId}
      />
    </>
  );
}