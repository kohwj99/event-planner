import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Checkbox,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Stack,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Search,
  EventSeat,
  Visibility,
  VisibilityOff,
  Info,
  Groups,
  PersonAdd,
} from '@mui/icons-material';
import { useEventStore } from '@/store/eventStore';
import { useGuestStore } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import { Guest } from '@/store/guestStore';

interface GuestManagementModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  dayId: string;
  sessionId: string;
  sessionName: string;
}

type TabValue = 'attendees' | 'seating';

export default function GuestManagementModal({
  open,
  onClose,
  eventId,
  dayId,
  sessionId,
  sessionName,
}: GuestManagementModalProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('attendees');
  const [searchQuery, setSearchQuery] = useState('');

  // Event Store
  const event = useEventStore((state) => state.events.find((e) => e.id === eventId));
  const setSessionGuests = useEventStore((state) => state.setSessionGuests);
  const getSessionGuests = useEventStore((state) => state.getSessionGuests);

  // Guest Store (active guests in planner)
  const hostGuests = useGuestStore((state) => state.hostGuests);
  const externalGuests = useGuestStore((state) => state.externalGuests);
  const resetGuests = useGuestStore((state) => state.resetGuests);
  const addGuest = useGuestStore((state) => state.addGuest);
  const updateGuest = useGuestStore((state) => state.updateGuest);

  // Seat Store
  const tables = useSeatStore((state) => state.tables);
  const findGuestSeat = useSeatStore((state) => state.findGuestSeat);

  // Local state for attendee selection
  const [selectedHostIds, setSelectedHostIds] = useState<Set<string>>(new Set());
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Load current session guest selection
  useEffect(() => {
    if (!open) return;

    const sessionGuests = getSessionGuests(sessionId);
    if (sessionGuests) {
      setSelectedHostIds(new Set(sessionGuests.hostGuests.map((g) => g.id)));
      setSelectedExternalIds(new Set(sessionGuests.externalGuests.map((g) => g.id)));
    }
    setHasChanges(false);
  }, [open, sessionId, getSessionGuests]);

  // Get all active guests (currently in planner)
  const allActiveGuests = useMemo(() => {
    return [...hostGuests, ...externalGuests];
  }, [hostGuests, externalGuests]);

  // Filter guests based on search
  const filterGuests = (guests: Guest[]) => {
    if (!searchQuery) return guests;
    const query = searchQuery.toLowerCase();
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(query) ||
        g.company.toLowerCase().includes(query) ||
        g.title.toLowerCase().includes(query)
    );
  };

  const filteredMasterHost = useMemo(
    () => filterGuests(event?.masterHostGuests || []),
    [event?.masterHostGuests, searchQuery]
  );

  const filteredMasterExternal = useMemo(
    () => filterGuests(event?.masterExternalGuests || []),
    [event?.masterExternalGuests, searchQuery]
  );

  const filteredActiveGuests = useMemo(
    () => filterGuests(allActiveGuests),
    [allActiveGuests, searchQuery]
  );

  // Handle attendee selection
  const handleToggleGuest = (guestId: string, isHost: boolean) => {
    if (isHost) {
      const newSet = new Set(selectedHostIds);
      if (newSet.has(guestId)) {
        newSet.delete(guestId);
      } else {
        newSet.add(guestId);
      }
      setSelectedHostIds(newSet);
    } else {
      const newSet = new Set(selectedExternalIds);
      if (newSet.has(guestId)) {
        newSet.delete(guestId);
      } else {
        newSet.add(guestId);
      }
      setSelectedExternalIds(newSet);
    }
    setHasChanges(true);
  };

  // Handle visibility toggle (soft delete)
  const handleToggleVisibility = (guestId: string) => {
    const guest = allActiveGuests.find((g) => g.id === guestId);
    if (guest) {
      updateGuest(guestId, { deleted: !guest.deleted });
    }
  };

  // Save attendee changes
  const handleSaveAttendees = () => {
    // Update session guest list in event store
    setSessionGuests(
      eventId,
      dayId,
      sessionId,
      Array.from(selectedHostIds),
      Array.from(selectedExternalIds)
    );

    // Reload active guests in planner
    resetGuests();
    
    const allMasterGuests = [
      ...(event?.masterHostGuests || []),
      ...(event?.masterExternalGuests || []),
    ];

    const selectedIds = new Set([...selectedHostIds, ...selectedExternalIds]);
    
    allMasterGuests
      .filter((g) => selectedIds.has(g.id))
      .forEach((g) => addGuest(g));

    setHasChanges(false);
    
    // Show success message
    alert(`Attendee list updated! ${selectedIds.size} guests selected.`);
  };

  // Get seat information for a guest
  const getGuestSeatInfo = (guestId: string) => {
    const seatInfo = findGuestSeat(guestId);
    if (!seatInfo) return null;

    const table = tables.find((t) => t.id === seatInfo.tableId);
    const seat = table?.seats.find((s) => s.id === seatInfo.seatId);

    if (!table || !seat) return null;

    return {
      tableName: table.label,
      seatNumber: seat.seatNumber,
    };
  };

  const selectedCount = selectedHostIds.size + selectedExternalIds.size;
  const seatedCount = allActiveGuests.filter((g) => findGuestSeat(g.id) !== null).length;
  const activeCount = allActiveGuests.filter((g) => !g.deleted).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">{sessionName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Guest Management
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              icon={<Groups />}
              label={`${selectedCount} Selected`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<EventSeat />}
              label={`${seatedCount} Seated`}
              color="success"
              variant="outlined"
            />
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)}>
            <Tab
              icon={<PersonAdd />}
              iconPosition="start"
              label="Manage Attendees"
              value="attendees"
            />
            <Tab
              icon={<EventSeat />}
              iconPosition="start"
              label="Seating Status"
              value="seating"
            />
          </Tabs>
        </Box>

        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search guests by name, company, or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* ATTENDEES TAB */}
        {activeTab === 'attendees' && (
          <Box>
            <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
              Select guests from the master list to include them in this session. Only
              selected guests will appear in the seat planner.
            </Alert>

            {hasChanges && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                You have unsaved changes. Click "Save Attendees" to apply.
              </Alert>
            )}

            {/* Host Guests */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Host Attendees
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">Select</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>VIP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMasterHost.map((guest) => (
                    <TableRow key={guest.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedHostIds.has(guest.id)}
                          onChange={() => handleToggleGuest(guest.id, true)}
                        />
                      </TableCell>
                      <TableCell>{guest.name}</TableCell>
                      <TableCell>{guest.title}</TableCell>
                      <TableCell>{guest.company}</TableCell>
                      <TableCell>
                        {guest.ranking <= 4 && (
                          <Chip label="VIP" size="small" color="error" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* External Guests */}
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              External Attendees
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">Select</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>VIP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMasterExternal.map((guest) => (
                    <TableRow key={guest.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedExternalIds.has(guest.id)}
                          onChange={() => handleToggleGuest(guest.id, false)}
                        />
                      </TableCell>
                      <TableCell>{guest.name}</TableCell>
                      <TableCell>{guest.title}</TableCell>
                      <TableCell>{guest.company}</TableCell>
                      <TableCell>
                        {guest.ranking <= 4 && (
                          <Chip label="VIP" size="small" color="error" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* SEATING TAB */}
        {activeTab === 'seating' && (
          <Box>
            <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
              Hide guests to exclude them from auto-fill. Hidden guests can still be manually
              assigned to seats. View seat assignments below.
            </Alert>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip
                label={`${activeCount} Active`}
                color="success"
                size="small"
              />
              <Chip
                label={`${allActiveGuests.length - activeCount} Hidden`}
                color="default"
                size="small"
              />
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>VIP</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Seat Assignment</TableCell>
                    <TableCell>Visibility</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredActiveGuests.map((guest) => {
                    const seatInfo = getGuestSeatInfo(guest.id);
                    const isHidden = guest.deleted;

                    return (
                      <TableRow
                        key={guest.id}
                        hover
                        sx={{
                          opacity: isHidden ? 0.5 : 1,
                          bgcolor: isHidden ? 'action.hover' : 'inherit',
                        }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              textDecoration: isHidden ? 'line-through' : 'none',
                            }}
                          >
                            {guest.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{guest.title}</TableCell>
                        <TableCell>{guest.company}</TableCell>
                        <TableCell>
                          {guest.ranking <= 4 && (
                            <Chip label="VIP" size="small" color="error" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={guest.fromHost ? 'Host' : 'External'}
                            size="small"
                            color={guest.fromHost ? 'primary' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {seatInfo ? (
                            <Chip
                              icon={<EventSeat />}
                              label={`${seatInfo.tableName} - Seat ${seatInfo.seatNumber}`}
                              size="small"
                              color="success"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Not seated
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip
                            title={isHidden ? 'Show (enable auto-fill)' : 'Hide (disable auto-fill)'}
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleToggleVisibility(guest.id)}
                              color={isHidden ? 'default' : 'primary'}
                            >
                              {isHidden ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {activeTab === 'attendees' && (
          <Button
            variant="contained"
            onClick={handleSaveAttendees}
            disabled={!hasChanges}
          >
            Save Attendees
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}