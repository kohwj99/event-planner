'use client';

import { useState } from "react";
import {
  Typography,
  Box,
  Button,
  Stack,
  Divider,
  Chip,
} from "@mui/material";
import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";
import AssignGuestModal from "@/components/molecules/AssignGuestModal";

export default function PlaygroundRightConfigPanel() {
  const {
    tables,
    selectedTableId,
    selectedSeatId,
    assignGuestToSeat,
    lockSeat,
    clearSeat,
  } = useSeatStore();

  const { hostGuests, externalGuests } = useGuestStore();
  const guestLookup = [...hostGuests, ...externalGuests].reduce(
    (acc, g) => ((acc[g.id] = g), acc),
    {} as Record<string, any>
  );

  const [openAssignModal, setOpenAssignModal] = useState(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const selectedSeat = selectedTable?.seats.find(
    (s) => s.id === selectedSeatId
  );
  const guest = selectedSeat?.assignedGuestId
    ? guestLookup[selectedSeat.assignedGuestId]
    : null;

  return (
    <Box p={3} sx={{ width: 320 }}>
      <Typography variant="h6" color="text.primary" gutterBottom>
        {selectedTable
          ? `Selected: ${selectedTable.label}`
          : "No table selected"}
      </Typography>

      {selectedTable && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Shape: {selectedTable.shape}
          <br />
          Seats: {selectedTable.seats.length}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      {selectedSeat ? (
        <>
          <Typography variant="subtitle1" color="text.primary" gutterBottom>
            Seat Info
          </Typography>

          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Seat ID: {selectedSeat.id}</Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              Locked:{" "}
              <Chip
                size="small"
                label={selectedSeat.locked ? "Yes" : "No"}
                color={selectedSeat.locked ? "error" : "default"}
              />
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              Guest:{" "}
              {guest ? (
                <Chip
                  size="small"
                  color="success"
                  label={guest.name}
                  sx={{ fontWeight: 500 }}
                />
              ) : (
                <Chip size="small" label="Unassigned" />
              )}
            </Typography>
          </Stack>

          <Stack spacing={1}>
            <Button
              variant="contained"
              disabled={selectedSeat.locked}
              onClick={() => setOpenAssignModal(true)}
            >
              {guest ? "Reassign Guest" : "Assign Guest"}
            </Button>

            <Button
              variant="outlined"
              color="error"
              disabled={!guest}
              onClick={() =>
                clearSeat(selectedTableId!, selectedSeatId!)
              }
            >
              Clear Seat
            </Button>

            <Button
              variant="outlined"
              onClick={() =>
                lockSeat(selectedTableId!, selectedSeatId!, !selectedSeat.locked)
              }
            >
              {selectedSeat.locked ? "Unlock Seat" : "Lock Seat"}
            </Button>
          </Stack>

          <AssignGuestModal
            open={openAssignModal}
            onClose={() => setOpenAssignModal(false)}
            tableId={selectedTableId!}
            seatId={selectedSeatId!}
            onConfirm={(guestId) => {
              assignGuestToSeat(selectedTableId!, selectedSeatId!, guestId);
            }}
          />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No seat selected
        </Typography>
      )}
    </Box>
  );
}
