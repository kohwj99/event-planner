"use client";

import { Typography, Alert, Box } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { Event } from "@/types/Event";
import { getEventSummary } from "@/utils/eventImportUtils";
import ConfirmDialog from "@/components/shared/molecules/ConfirmDialog";
import SummaryInfoBox from "@/components/shared/atoms/SummaryInfoBox";

interface ExportEventDialogProps {
  open: boolean;
  event: Event | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExportEventDialog({
  open,
  event,
  onConfirm,
  onCancel
}: ExportEventDialogProps) {
  if (!event) return null;

  const summary = getEventSummary(event);

  return (
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      onConfirm={onConfirm}
      title="Export Event"
      confirmLabel="Export"
      confirmIcon={<FileDownloadIcon />}
    >
      <Box>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Are you sure you want to export <strong>{event.name}</strong>?
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The exported JSON file will contain all event data including:
        </Typography>

        <SummaryInfoBox>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Event details and settings
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            All days and sessions ({summary.daysCount} days, {summary.sessionsCount} sessions)
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Master guest lists ({summary.hostGuestsCount} host, {summary.externalGuestsCount} external)
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Seat plans and table configurations
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Tracking data and adjacency records
          </Typography>
        </SummaryInfoBox>

        <Alert severity="info" sx={{ mt: 2 }}>
          You can re-import this file later to restore the event on any device.
        </Alert>
      </Box>
    </ConfirmDialog>
  );
}
