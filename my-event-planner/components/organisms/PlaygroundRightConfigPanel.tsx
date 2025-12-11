// components/organisms/PlaygroundRightConfigPanel.tsx
// Enhanced with Lock Table, Delete Table, and Modify Table features

'use client';

import { useState, useMemo } from 'react';
import {
  Typography,
  Box,
  Button,
  Stack,
  Divider,
  Chip,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  SwapHoriz,
  Lock,
  LockOpen,
  DeleteForever,
  Edit,
  TableRestaurant,
} from '@mui/icons-material';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import AssignGuestModal from '@/components/molecules/AssignGuestModal';
import SwapSeatModal from '@/components/molecules/SwapSeatModal';
import GuestReassignConfirmModal from '@/components/molecules/GuestReassignConfirmModal';
import ModifyTableModal from '@/components/molecules/ModifyTableModal';
import DeleteTableConfirmModal from '@/components/molecules/DeleteTableConfirmModal';
import { Table } from '@/types/Table';

export default function PlaygroundRightConfigPanel() {
  const {
    tables,
    selectedTableId,
    selectedSeatId,
    assignGuestToSeat,
    lockSeat,
    clearSeat,
    findGuestSeat,
    // NEW: Table-level operations
    lockAllSeatsInTable,
    unlockAllSeatsInTable,
    deleteTable,
    replaceTable,
    clearAllSeatsInTable,
  } = useSeatStore();

  const { hostGuests, externalGuests } = useGuestStore();
  const guestLookup = [...hostGuests, ...externalGuests].reduce(
    (acc, g) => ((acc[g.id] = g), acc),
    {} as Record<string, any>
  );

  // Seat-level modals
  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [openSwapModal, setOpenSwapModal] = useState(false);
  const [openReassignConfirm, setOpenReassignConfirm] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{
    guestId: string;
    currentTableId: string;
    currentSeatId: string;
  } | null>(null);

  // NEW: Table-level modals
  const [openModifyModal, setOpenModifyModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const selectedSeat = selectedTable?.seats.find((s) => s.id === selectedSeatId);
  const guest = selectedSeat?.assignedGuestId
    ? guestLookup[selectedSeat.assignedGuestId]
    : null;

  // NEW: Calculate table-level statistics
  const tableStats = useMemo(() => {
    if (!selectedTable) return null;

    const totalSeats = selectedTable.seats.length;
    const lockedSeats = selectedTable.seats.filter((s) => s.locked).length;
    const seatedGuests = selectedTable.seats.filter((s) => s.assignedGuestId).length;
    const emptySeats = totalSeats - seatedGuests;
    const allLocked = lockedSeats === totalSeats;
    const noneLocked = lockedSeats === 0;

    return {
      totalSeats,
      lockedSeats,
      seatedGuests,
      emptySeats,
      allLocked,
      noneLocked,
    };
  }, [selectedTable]);

  // Seat assignment handlers
  const handleAssignGuest = (guestId: string | null) => {
    if (!selectedTableId || !selectedSeatId) return;

    // If clearing the seat
    if (guestId === null) {
      clearSeat(selectedTableId, selectedSeatId);
      return;
    }

    // Check if guest is already seated elsewhere
    const currentLocation = findGuestSeat(guestId);

    if (
      currentLocation &&
      (currentLocation.tableId !== selectedTableId || currentLocation.seatId !== selectedSeatId)
    ) {
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
    const currentTable = tables.find((t) => t.id === pendingAssignment.currentTableId);
    const currentSeat = currentTable?.seats.find((s) => s.id === pendingAssignment.currentSeatId);

    return {
      guestName: guest?.name || 'Unknown',
      currentTable: currentTable?.label || 'Unknown',
      currentSeat: currentSeat?.seatNumber || 0,
      newTable: selectedTable?.label || 'Unknown',
      newSeat: selectedSeat?.seatNumber || 0,
    };
  };

  const reassignInfo = getReassignInfo();

  // NEW: Table-level action handlers

  /**
   * Lock all seats in the selected table
   */
  const handleLockTable = () => {
    if (!selectedTableId) return;
    lockAllSeatsInTable(selectedTableId);
  };

  /**
   * Unlock all seats in the selected table
   */
  const handleUnlockTable = () => {
    if (!selectedTableId) return;
    unlockAllSeatsInTable(selectedTableId);
  };

  /**
   * Delete the selected table (opens confirmation modal)
   */
  const handleDeleteTable = () => {
    if (!selectedTableId) return;
    setOpenDeleteModal(true);
  };

  /**
   * Confirm table deletion
   */
  const handleConfirmDeleteTable = () => {
    if (!selectedTableId) return;
    // The deleteTable action will:
    // 1. Unseat all guests
    // 2. Remove the table from chunks
    // 3. Reorder subsequent tables
    deleteTable(selectedTableId);
    setOpenDeleteModal(false);
  };

  /**
   * Open the modify table modal
   */
  const handleModifyTable = () => {
    if (!selectedTableId) return;
    setOpenModifyModal(true);
  };

  /**
   * Confirm table modification
   */
  const handleConfirmModifyTable = (newTable: Table) => {
    if (!selectedTableId) return;
    // Clear all guests first (modifying unseats all guests)
    clearAllSeatsInTable(selectedTableId);
    // Replace the table with the new configuration
    replaceTable(selectedTableId, newTable);
    setOpenModifyModal(false);
  };

  return (
    <Box p={3} sx={{ width: 320 }}>
      {/* Table Selection Header */}
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <TableRestaurant color={selectedTable ? 'primary' : 'disabled'} />
        <Typography variant="h6" color="text.primary">
          {selectedTable ? `Selected: ${selectedTable.label}` : 'No table selected'}
        </Typography>
      </Stack>

      {/* Table Info */}
      {selectedTable && (
        <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label={selectedTable.shape === 'round' ? 'Round' : 'Rectangle'}
                color="primary"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                {tableStats?.totalSeats} seats
              </Typography>
            </Stack>

            <Stack direction="row" spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Seated
                </Typography>
                <Typography variant="body2" fontWeight={500} color="success.main">
                  {tableStats?.seatedGuests}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Empty
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {tableStats?.emptySeats}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Locked
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color={tableStats?.lockedSeats ? 'error.main' : 'text.secondary'}
                >
                  {tableStats?.lockedSeats}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Paper>
      )}

      {/* NEW: Table Actions Section */}
      {selectedTable && (
        <>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Table Actions
          </Typography>

          <Stack spacing={1} sx={{ mb: 2 }}>
            {/* Lock/Unlock Table Button */}
            <Tooltip
              title={
                tableStats?.allLocked
                  ? 'Unlock all seats in this table'
                  : 'Lock all seats in this table'
              }
              placement="left"
            >
              <Button
                variant="outlined"
                color={tableStats?.allLocked ? 'success' : 'warning'}
                startIcon={tableStats?.allLocked ? <LockOpen /> : <Lock />}
                onClick={tableStats?.allLocked ? handleUnlockTable : handleLockTable}
                fullWidth
              >
                {tableStats?.allLocked ? 'Unlock Table' : 'Lock Table'}
              </Button>
            </Tooltip>

            {/* Modify Table Button */}
            <Tooltip title="Edit table configuration (seats, ordering, etc.)" placement="left">
              <Button
                variant="outlined"
                color="primary"
                startIcon={<Edit />}
                onClick={handleModifyTable}
                fullWidth
              >
                Modify Table
              </Button>
            </Tooltip>

            {/* Delete Table Button */}
            <Tooltip title="Delete this table and unseat all guests" placement="left">
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteForever />}
                onClick={handleDeleteTable}
                fullWidth
              >
                Delete Table
              </Button>
            </Tooltip>
          </Stack>

          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Seat Selection Section */}
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
              Status:{' '}
              <Chip
                size="small"
                label={selectedSeat.locked ? 'Locked' : 'Unlocked'}
                color={selectedSeat.locked ? 'error' : 'default'}
              />
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              Guest:{' '}
              {guest ? (
                <Stack direction="column" spacing={0.5} sx={{ mt: 1 }}>
                  <Chip size="small" color="success" label={guest.name} sx={{ fontWeight: 500 }} />
                  <Typography variant="caption" color="text.secondary">
                    {guest.title} • {guest.company}
                  </Typography>
                </Stack>
              ) : (
                <Chip size="small" label="Unassigned" />
              )}
            </Typography>
          </Stack>

          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Seat Actions
          </Typography>

          <Stack spacing={1}>
            <Button
              variant="contained"
              disabled={selectedSeat.locked}
              onClick={() => setOpenAssignModal(true)}
            >
              {guest ? 'Reassign Guest' : 'Assign Guest'}
            </Button>

            {/* Swap Seat Button */}
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
              onClick={() => clearSeat(selectedTableId!, selectedSeatId!)}
            >
              Clear Seat
            </Button>

            <Button
              variant="outlined"
              onClick={() => lockSeat(selectedTableId!, selectedSeatId!, !selectedSeat.locked)}
            >
              {selectedSeat.locked ? 'Unlock Seat' : 'Lock Seat'}
            </Button>
          </Stack>

          {/* Seat-level Modals */}
          <AssignGuestModal
            open={openAssignModal}
            onClose={() => setOpenAssignModal(false)}
            tableId={selectedTableId!}
            seatId={selectedSeatId!}
            onConfirm={handleAssignGuest}
          />

          {guest && (
            <SwapSeatModal
              open={openSwapModal}
              onClose={() => setOpenSwapModal(false)}
              sourceTableId={selectedTableId!}
              sourceSeatId={selectedSeatId!}
            />
          )}

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
      ) : selectedTable ? (
        <Typography variant="body2" color="text.secondary">
          Click on a seat to select it
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Click on a table or seat to select it
        </Typography>
      )}

      {/* Table-level Modals */}
      <ModifyTableModal
        open={openModifyModal}
        onClose={() => setOpenModifyModal(false)}
        onConfirm={handleConfirmModifyTable}
        table={selectedTable || null}
      />

      <DeleteTableConfirmModal
        open={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        onConfirm={handleConfirmDeleteTable}
        table={selectedTable || null}
      />
    </Box>
  );
}