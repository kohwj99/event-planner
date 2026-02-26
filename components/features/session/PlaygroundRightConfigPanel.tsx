// components/organisms/PlaygroundRightConfigPanel.tsx
// Enhanced with Lock Table, Delete Table, and Modify Table features
// 🆕 UPDATED: Added isLocked prop to disable all editing when session is locked

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
  Alert,
} from '@mui/material';
import {
  SwapHoriz,
  Lock,
  LockOpen,
  DeleteForever,
  Edit,
  TableRestaurant,
  Info,
} from '@mui/icons-material';
import { useSeatStore } from '@/store/seatStore';
import { useGuestStore } from '@/store/guestStore';
import { useCaptureSnapshot } from '@/components/providers/UndoRedoProvider';
import AssignGuestModal from '@/components/features/session/AssignGuestModal';
import SwapSeatModal from '@/components/features/session/SwapSeatModal';
import GuestReassignConfirmModal from '@/components/features/session/GuestReassignConfirmModal';
import ModifyTableModal from '@/components/features/session/ModifyTableModal';
import DeleteTableConfirmModal from '@/components/features/session/DeleteTableConfirmModal';
import { Table } from '@/types/Table';

interface PlaygroundRightConfigPanelProps {
  /** 🆕 When true, all editing actions are disabled */
  isLocked?: boolean;
}

export default function PlaygroundRightConfigPanel({ isLocked = false }: PlaygroundRightConfigPanelProps) {
  const {
    tables,
    selectedTableId,
    selectedSeatId,
    assignGuestToSeat,
    lockSeat,
    clearSeat,
    findGuestSeat,
    lockAllSeatsInTable,
    unlockAllSeatsInTable,
    deleteTable,
    replaceTable,
    clearAllSeatsInTable,
  } = useSeatStore();

  const captureSnapshot = useCaptureSnapshot();

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

  // Table-level modals
  const [openModifyModal, setOpenModifyModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const selectedSeat = selectedTable?.seats.find((s) => s.id === selectedSeatId);
  const guest = selectedSeat?.assignedGuestId
    ? guestLookup[selectedSeat.assignedGuestId]
    : null;

  // Calculate table-level statistics
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

  // Seat assignment handlers - 🆕 Check isLocked
  const handleAssignGuest = (guestId: string | null) => {
    if (!selectedTableId || !selectedSeatId || isLocked) return;

    if (guestId === null) {
      captureSnapshot("Clear Seat");
      clearSeat(selectedTableId, selectedSeatId);
      return;
    }

    const currentLocation = findGuestSeat(guestId);

    if (
      currentLocation &&
      (currentLocation.tableId !== selectedTableId || currentLocation.seatId !== selectedSeatId)
    ) {
      setPendingAssignment({
        guestId,
        currentTableId: currentLocation.tableId,
        currentSeatId: currentLocation.seatId,
      });
      setOpenReassignConfirm(true);
    } else {
      captureSnapshot("Assign Guest");
      assignGuestToSeat(selectedTableId, selectedSeatId, guestId);
    }
  };

  const handleConfirmReassign = () => {
    if (!pendingAssignment || !selectedTableId || !selectedSeatId || isLocked) return;

    captureSnapshot("Assign Guest");
    clearSeat(pendingAssignment.currentTableId, pendingAssignment.currentSeatId);
    assignGuestToSeat(selectedTableId, selectedSeatId, pendingAssignment.guestId);

    setOpenReassignConfirm(false);
    setPendingAssignment(null);
  };

  const handleCancelReassign = () => {
    setOpenReassignConfirm(false);
    setPendingAssignment(null);
  };

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

  // Table-level action handlers - 🆕 Check isLocked
  const handleLockTable = () => {
    if (!selectedTableId || isLocked) return;
    captureSnapshot("Lock All Seats");
    lockAllSeatsInTable(selectedTableId);
  };

  const handleUnlockTable = () => {
    if (!selectedTableId || isLocked) return;
    captureSnapshot("Unlock All Seats");
    unlockAllSeatsInTable(selectedTableId);
  };

  const handleDeleteTable = () => {
    if (!selectedTableId || isLocked) return;
    setOpenDeleteModal(true);
  };

  const handleConfirmDeleteTable = () => {
    if (!selectedTableId || isLocked) return;
    captureSnapshot("Delete Table");
    deleteTable(selectedTableId);
    setOpenDeleteModal(false);
  };

  const handleModifyTable = () => {
    if (!selectedTableId || isLocked) return;
    setOpenModifyModal(true);
  };

  const handleConfirmModifyTable = (newTable: Table) => {
    if (!selectedTableId || isLocked) return;
    captureSnapshot("Modify Table");
    clearAllSeatsInTable(selectedTableId);
    replaceTable(selectedTableId, newTable);
    setOpenModifyModal(false);
  };

  return (
    <Box p={3} sx={{ width: 320 }}>
      {/* 🆕 Lock Warning */}
      {isLocked && (
        <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
          Session is locked. Editing disabled.
        </Alert>
      )}

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

      {/* Table Actions Section */}
      {selectedTable && (
        <>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Table Actions
          </Typography>

          <Stack spacing={1} sx={{ mb: 2 }}>
            {/* 🆕 All buttons disabled when isLocked */}
            <Tooltip
              title={
                isLocked
                  ? 'Session is locked'
                  : tableStats?.allLocked
                  ? 'Unlock all seats in this table'
                  : 'Lock all seats in this table'
              }
              placement="left"
            >
              <span>
                <Button
                  variant="outlined"
                  color={tableStats?.allLocked ? 'success' : 'warning'}
                  startIcon={tableStats?.allLocked ? <LockOpen /> : <Lock />}
                  onClick={tableStats?.allLocked ? handleUnlockTable : handleLockTable}
                  fullWidth
                  disabled={isLocked}
                >
                  {tableStats?.allLocked ? 'Unlock Table' : 'Lock Table'}
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={isLocked ? 'Session is locked' : 'Edit table configuration'} placement="left">
              <span>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<Edit />}
                  onClick={handleModifyTable}
                  fullWidth
                  disabled={isLocked}
                >
                  Modify Table
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={isLocked ? 'Session is locked' : 'Delete this table'} placement="left">
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteForever />}
                  onClick={handleDeleteTable}
                  fullWidth
                  disabled={isLocked}
                >
                  Delete Table
                </Button>
              </span>
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
            {/* 🆕 All seat actions disabled when isLocked */}
            <Tooltip title={isLocked ? 'Session is locked' : ''}>
              <span>
                <Button
                  variant="contained"
                  disabled={selectedSeat.locked || isLocked}
                  onClick={() => setOpenAssignModal(true)}
                  fullWidth
                >
                  {guest ? 'Reassign Guest' : 'Assign Guest'}
                </Button>
              </span>
            </Tooltip>

            {guest && (
              <Tooltip title={isLocked ? 'Session is locked' : ''}>
                <span>
                  <Button
                    variant="contained"
                    color="secondary"
                    disabled={selectedSeat.locked || isLocked}
                    onClick={() => setOpenSwapModal(true)}
                    startIcon={<SwapHoriz />}
                    fullWidth
                  >
                    Swap Seat
                  </Button>
                </span>
              </Tooltip>
            )}

            <Tooltip title={isLocked ? 'Session is locked' : ''}>
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={!guest || isLocked}
                  onClick={() => {
                    captureSnapshot("Clear Seat");
                    clearSeat(selectedTableId!, selectedSeatId!);
                  }}
                  fullWidth
                >
                  Clear Seat
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={isLocked ? 'Session is locked' : ''}>
              <span>
                <Button
                  variant="outlined"
                  onClick={() => {
                    captureSnapshot(selectedSeat.locked ? "Unlock Seat" : "Lock Seat");
                    lockSeat(selectedTableId!, selectedSeatId!, !selectedSeat.locked);
                  }}
                  disabled={isLocked}
                  fullWidth
                >
                  {selectedSeat.locked ? 'Unlock Seat' : 'Lock Seat'}
                </Button>
              </span>
            </Tooltip>
          </Stack>

          {/* Seat-level Modals - 🆕 Only open if not locked */}
          <AssignGuestModal
            open={openAssignModal && !isLocked}
            onClose={() => setOpenAssignModal(false)}
            tableId={selectedTableId!}
            seatId={selectedSeatId!}
            onConfirm={handleAssignGuest}
          />

          {guest && (
            <SwapSeatModal
              open={openSwapModal && !isLocked}
              onClose={() => setOpenSwapModal(false)}
              sourceTableId={selectedTableId!}
              sourceSeatId={selectedSeatId!}
            />
          )}

          {reassignInfo && (
            <GuestReassignConfirmModal
              open={openReassignConfirm && !isLocked}
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

      {/* Table-level Modals - 🆕 Only open if not locked */}
      <ModifyTableModal
        open={openModifyModal && !isLocked}
        onClose={() => setOpenModifyModal(false)}
        onConfirm={handleConfirmModifyTable}
        table={selectedTable || null}
      />

      <DeleteTableConfirmModal
        open={openDeleteModal && !isLocked}
        onClose={() => setOpenDeleteModal(false)}
        onConfirm={handleConfirmDeleteTable}
        table={selectedTable || null}
      />
    </Box>
  );
}