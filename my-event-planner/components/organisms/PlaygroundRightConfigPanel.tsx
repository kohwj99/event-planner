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
import { SwapHoriz } from "@mui/icons-material";
import { useSeatStore } from "@/store/seatStore";
import { useGuestStore } from "@/store/guestStore";
import AssignGuestModal from "@/components/molecules/AssignGuestModal";
import SwapSeatModal from "@/components/molecules/SwapSeatModal";
import GuestReassignConfirmModal from "@/components/molecules/GuestReassignConfirmModal";

export default function PlaygroundRightConfigPanel() {
  const {
    tables,
    selectedTableId,
    selectedSeatId,
    assignGuestToSeat,
    lockSeat,
    clearSeat,
    findGuestSeat,
    proximityRules
  } = useSeatStore();

  const { hostGuests, externalGuests } = useGuestStore();
  const guestLookup = [...hostGuests, ...externalGuests].reduce(
    (acc, g) => ((acc[g.id] = g), acc),
    {} as Record<string, any>
  );

  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [openSwapModal, setOpenSwapModal] = useState(false);
  const [openReassignConfirm, setOpenReassignConfirm] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{
    guestId: string;
    currentTableId: string;
    currentSeatId: string;
  } | null>(null);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const selectedSeat = selectedTable?.seats.find(
    (s) => s.id === selectedSeatId
  );
  const guest = selectedSeat?.assignedGuestId
    ? guestLookup[selectedSeat.assignedGuestId]
    : null;

  const handleAssignGuest = (guestId: string | null) => {
    if (!selectedTableId || !selectedSeatId) return;

    // If clearing the seat
    if (guestId === null) {
      clearSeat(selectedTableId, selectedSeatId);
      return;
    }

    // Check if guest is already seated elsewhere
    const currentLocation = findGuestSeat(guestId);
    
    if (currentLocation && 
        (currentLocation.tableId !== selectedTableId || currentLocation.seatId !== selectedSeatId)) {
      // Guest is already seated elsewhere - show confirmation
      setPendingAssignment({
        guestId,
        currentTableId: currentLocation.tableId,
        currentSeatId: currentLocation.seatId,
      });
      setOpenReassignConfirm(true);
    } else {
      // Guest not seated or same seat - proceed directly
      assignGuestToSeat(selectedTableId, selectedSeatId, guestId);
    }
  };

  const handleConfirmReassign = () => {
    if (!pendingAssignment || !selectedTableId || !selectedSeatId) return;

    // Clear from old location
    clearSeat(pendingAssignment.currentTableId, pendingAssignment.currentSeatId);
    
    // Assign to new location
    assignGuestToSeat(selectedTableId, selectedSeatId, pendingAssignment.guestId);
    
    // Close modal and reset
    setOpenReassignConfirm(false);
    setPendingAssignment(null);
  };

  const handleCancelReassign = () => {
    setOpenReassignConfirm(false);
    setPendingAssignment(null);
  };

  // Get info for reassign confirmation modal
  const getReassignInfo = () => {
    if (!pendingAssignment) return null;
    
    const guest = guestLookup[pendingAssignment.guestId];
    const currentTable = tables.find(t => t.id === pendingAssignment.currentTableId);
    const currentSeat = currentTable?.seats.find(s => s.id === pendingAssignment.currentSeatId);
    
    return {
      guestName: guest?.name || 'Unknown',
      currentTable: currentTable?.label || 'Unknown',
      currentSeat: currentSeat?.seatNumber || 0,
      newTable: selectedTable?.label || 'Unknown',
      newSeat: selectedSeat?.seatNumber || 0,
    };
  };

  const reassignInfo = getReassignInfo();

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
            <Typography variant="body2" color="text.secondary">
              Seat Number: {selectedSeat.seatNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              Status:{" "}
              <Chip
                size="small"
                label={selectedSeat.locked ? "Locked" : "Unlocked"}
                color={selectedSeat.locked ? "error" : "default"}
              />
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              Guest:{" "}
              {guest ? (
                <Stack direction="column" spacing={0.5} sx={{ mt: 1 }}>
                  <Chip
                    size="small"
                    color="success"
                    label={guest.name}
                    sx={{ fontWeight: 500 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {guest.title} • {guest.company}
                  </Typography>
                </Stack>
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

            {/* NEW: Swap Seat Button */}
            {guest && (
              <Button
                variant="contained"
                color="secondary"
                disabled={selectedSeat.locked}
                onClick={() => setOpenSwapModal(true)}
                startIcon={<SwapHoriz />}
              >
                Swap Seat
              </Button>
            )}

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
            onConfirm={handleAssignGuest}
          />

          {/* NEW: Swap Modal */}
          {guest && (
            <SwapSeatModal
              open={openSwapModal}
              onClose={() => setOpenSwapModal(false)}
              sourceTableId={selectedTableId!}
              sourceSeatId={selectedSeatId!}
              proximityRules={proximityRules!}
            />
          )}

          {/* NEW: Reassign Confirmation Modal */}
          {reassignInfo && (
            <GuestReassignConfirmModal
              open={openReassignConfirm}
              onClose={handleCancelReassign}
              onConfirm={handleConfirmReassign}
              guestName={reassignInfo.guestName}
              currentTable={reassignInfo.currentTable}
              currentSeat={reassignInfo.currentSeat}
              newTable={reassignInfo.newTable}
              newSeat={reassignInfo.newSeat}
            />
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No seat selected
        </Typography>
      )}
    </Box>
  );
}