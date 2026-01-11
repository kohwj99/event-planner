'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  InputAdornment,
  Checkbox,
  Chip,
  Alert,
  FormControlLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  CheckCircle, 
  Circle, 
  Groups, 
  EventSeat, 
  PersonAdd,
  Visibility,
  VisibilityOff,
  Info,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { useEventStore } from '@/store/eventStore';
import { useGuestStore, Guest } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';

interface SessionGuestListModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  dayId: string;
  sessionId: string;
  sessionName: string;
}

type MainTabValue = 'attendees' | 'seating';
type GuestTypeTab = 'host' | 'external';
type SortField = 'name' | 'gender' | 'company' | 'country' | 'title' | 'ranking';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Column configuration for consistent ordering
const COLUMNS: { field: SortField; label: string; width: number }[] = [
  { field: 'name', label: 'Name', width: 180 },
  { field: 'gender', label: 'Gender', width: 80 },
  { field: 'company', label: 'Company', width: 150 },
  { field: 'country', label: 'Country', width: 100 },
  { field: 'title', label: 'Title', width: 150 },
  { field: 'ranking', label: 'Rank', width: 70 },
];

export default function SessionGuestListModal({
  open,
  onClose,
  eventId,
  dayId,
  sessionId,
  sessionName,
}: SessionGuestListModalProps) {
  // Event Store
  const event = useEventStore((s) => s.events.find(e => e.id === eventId));
  const setSessionGuests = useEventStore((s) => s.setSessionGuests);

  // Guest Store (active guests in planner)
  const hostGuests = useGuestStore((state) => state.hostGuests);
  const externalGuests = useGuestStore((state) => state.externalGuests);
  const resetGuests = useGuestStore((state) => state.resetGuests);
  const addGuest = useGuestStore((state) => state.addGuest);
  const updateGuest = useGuestStore((state) => state.updateGuest);

  // Seat Store
  const tables = useSeatStore((state) => state.tables);
  const findGuestSeat = useSeatStore((state) => state.findGuestSeat);

  // Main tab state (Attendees vs Seating Status)
  const [mainTab, setMainTab] = useState<MainTabValue>('attendees');
  
  // Guest type tab state (Host vs External) - for attendees tab
  const [attendeesGuestTypeTab, setAttendeesGuestTypeTab] = useState<GuestTypeTab>('host');
  
  // Guest type tab state (Host vs External) - for seating status tab
  const [seatingGuestTypeTab, setSeatingGuestTypeTab] = useState<GuestTypeTab>('host');
  
  // Search/filter state
  const [filter, setFilter] = useState('');
  
  // Sort state for attendees tab - default to ranking ascending (rank 1 first)
  const [attendeesSort, setAttendeesSort] = useState<SortConfig>({ field: 'ranking', direction: 'asc' });
  
  // Sort state for seating status tab - default to ranking ascending (rank 1 first)
  const [seatingSort, setSeatingSort] = useState<SortConfig>({ field: 'ranking', direction: 'asc' });
  
  // Selection state
  const [selectedHostIds, setSelectedHostIds] = useState<Set<string>>(new Set());
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());
  const [selectAllHost, setSelectAllHost] = useState(false);
  const [selectAllExternal, setSelectAllExternal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing session guests when modal opens
  useEffect(() => {
    if (open && event) {
      const session = event.days
        .find(d => d.id === dayId)
        ?.sessions.find(s => s.id === sessionId);
      
      if (session) {
        setSelectedHostIds(new Set(session.inheritedHostGuestIds || []));
        setSelectedExternalIds(new Set(session.inheritedExternalGuestIds || []));
        
        // Check if all are selected
        const allHostSelected = 
          (session.inheritedHostGuestIds?.length || 0) === event.masterHostGuests.length &&
          event.masterHostGuests.length > 0;
        const allExternalSelected = 
          (session.inheritedExternalGuestIds?.length || 0) === event.masterExternalGuests.length &&
          event.masterExternalGuests.length > 0;
          
        setSelectAllHost(allHostSelected);
        setSelectAllExternal(allExternalSelected);
      }
      
      setHasChanges(false);
      setFilter('');
    }
  }, [open, event, dayId, sessionId]);

  // Get all active guests (currently in planner)
  const allActiveGuests = useMemo(() => {
    return [...hostGuests, ...externalGuests];
  }, [hostGuests, externalGuests]);

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

  if (!event) return null;

  // Helper function to get guest field value for sorting
  const getGuestValue = (guest: Guest, field: SortField): string | number => {
    switch (field) {
      case 'name': return guest.name ?? '';
      case 'gender': return guest.gender ?? '';
      case 'company': return guest.company ?? '';
      case 'country': return guest.country ?? '';
      case 'title': return guest.title ?? '';
      case 'ranking': return guest.ranking ?? 999;
      default: return '';
    }
  };

  // Sort function
  const sortGuests = (guests: Guest[], sortConfig: SortConfig): Guest[] => {
    return [...guests].sort((a, b) => {
      const aVal = getGuestValue(a, sortConfig.field);
      const bVal = getGuestValue(b, sortConfig.field);
      
      // Numeric comparison for ranking
      if (sortConfig.field === 'ranking') {
        const aNum = typeof aVal === 'number' ? aVal : 999;
        const bNum = typeof bVal === 'number' ? bVal : 999;
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // String comparison for other fields
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const comparison = aStr.localeCompare(bStr);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  // Handle sort click
  const handleSortClick = (field: SortField, isSeatingTab: boolean) => {
    if (isSeatingTab) {
      setSeatingSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      setAttendeesSort(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    }
  };

  // Current attendees tab data
  const attendeesMasterGuests = attendeesGuestTypeTab === 'host' ? event.masterHostGuests : event.masterExternalGuests;
  const attendeesSelectedIds = attendeesGuestTypeTab === 'host' ? selectedHostIds : selectedExternalIds;
  const setAttendeesSelectedIds = attendeesGuestTypeTab === 'host' ? setSelectedHostIds : setSelectedExternalIds;

  // Current seating tab data
  const seatingActiveGuests = seatingGuestTypeTab === 'host' ? hostGuests : externalGuests;

  // Filter and sort guests for attendees tab (master list)
  const filteredSortedMasterGuests = useMemo(() => {
    let result = attendeesMasterGuests;
    
    // Apply filter
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(
        (g) =>
          (g.name ?? '').toLowerCase().includes(q) ||
          (g.gender ?? '').toLowerCase().includes(q) ||
          (g.company ?? '').toLowerCase().includes(q) ||
          (g.country ?? '').toLowerCase().includes(q) ||
          (g.title ?? '').toLowerCase().includes(q) ||
          String(g.ranking ?? '').includes(q)
      );
    }
    
    // Apply sort
    return sortGuests(result, attendeesSort);
  }, [filter, attendeesMasterGuests, attendeesSort]);

  // Filter and sort guests for seating tab (active guests)
  const filteredSortedActiveGuests = useMemo(() => {
    let result = seatingActiveGuests;
    
    // Apply filter
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(
        (g) =>
          (g.name ?? '').toLowerCase().includes(q) ||
          (g.gender ?? '').toLowerCase().includes(q) ||
          (g.company ?? '').toLowerCase().includes(q) ||
          (g.country ?? '').toLowerCase().includes(q) ||
          (g.title ?? '').toLowerCase().includes(q) ||
          String(g.ranking ?? '').includes(q)
      );
    }
    
    // Apply sort
    return sortGuests(result, seatingSort);
  }, [filter, seatingActiveGuests, seatingSort]);

  const handleToggleGuest = (guestId: string) => {
    const newSet = new Set(attendeesSelectedIds);
    if (newSet.has(guestId)) {
      newSet.delete(guestId);
    } else {
      newSet.add(guestId);
    }
    setAttendeesSelectedIds(newSet);
    setHasChanges(true);

    // Update select all checkbox
    if (attendeesGuestTypeTab === 'host') {
      setSelectAllHost(newSet.size === event.masterHostGuests.length);
    } else {
      setSelectAllExternal(newSet.size === event.masterExternalGuests.length);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (attendeesGuestTypeTab === 'host') {
      if (checked) {
        setSelectedHostIds(new Set(event.masterHostGuests.map(g => g.id)));
      } else {
        setSelectedHostIds(new Set());
      }
      setSelectAllHost(checked);
    } else {
      if (checked) {
        setSelectedExternalIds(new Set(event.masterExternalGuests.map(g => g.id)));
      } else {
        setSelectedExternalIds(new Set());
      }
      setSelectAllExternal(checked);
    }
    setHasChanges(true);
  };

  // Handle visibility toggle (soft delete) for seating tab
  const handleToggleVisibility = (guestId: string) => {
    const guest = allActiveGuests.find((g) => g.id === guestId);
    if (guest) {
      updateGuest(guestId, { deleted: !guest.deleted });
    }
  };

  const handleSave = () => {
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

    const allSelectedIds = new Set([...selectedHostIds, ...selectedExternalIds]);
    
    allMasterGuests
      .filter((g) => allSelectedIds.has(g.id))
      .forEach((g) => addGuest(g));

    setHasChanges(false);
    onClose();
  };

  const totalSelected = selectedHostIds.size + selectedExternalIds.size;
  const seatedCount = allActiveGuests.filter((g) => findGuestSeat(g.id) !== null).length;
  const activeCount = allActiveGuests.filter((g) => !g.deleted).length;

  // Get ranking color
  const getRankingColor = (ranking: number): 'error' | 'warning' | 'info' | 'default' => {
    if (ranking === 1) return 'error';
    if (ranking === 2) return 'warning';
    if (ranking <= 4) return 'info';
    return 'default';
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6">Manage Session Attendees</Typography>
            <Typography variant="body2" color="text.secondary">
              {sessionName}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              icon={<Groups />}
              label={`${totalSelected} Selected`}
              color="primary"
              variant="outlined"
            />
            {mainTab === 'seating' && (
              <Chip
                icon={<EventSeat />}
                label={`${seatedCount} Seated`}
                color="success"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#fafafa' }}>
        {/* Main Tabs: Attendees vs Seating Status */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={mainTab} onChange={(_, val) => setMainTab(val)}>
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

        {/* ===================== ATTENDEES TAB ===================== */}
        {mainTab === 'attendees' && (
          <>
            <Alert severity="info" sx={{ mb: 2 }} icon={<Groups />}>
              Select guests from the master guest lists to attend this session. 
              Only selected guests will appear in the seat planner.
            </Alert>

            {hasChanges && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                You have unsaved changes. Click "Save Attendees" to apply.
              </Alert>
            )}

            {/* Guest Type Tabs (Host/External) */}
            <Tabs 
              value={attendeesGuestTypeTab} 
              onChange={(_, v) => setAttendeesGuestTypeTab(v)} 
              sx={{ mb: 2 }}
            >
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <span>Host Company</span>
                    <Chip 
                      label={`${selectedHostIds.size}/${event.masterHostGuests.length}`} 
                      size="small" 
                      color={selectedHostIds.size > 0 ? "primary" : "default"}
                    />
                  </Box>
                } 
                value="host" 
              />
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <span>External Guests</span>
                    <Chip 
                      label={`${selectedExternalIds.size}/${event.masterExternalGuests.length}`} 
                      size="small" 
                      color={selectedExternalIds.size > 0 ? "primary" : "default"}
                    />
                  </Box>
                } 
                value="external" 
              />
            </Tabs>

            {/* Controls: Select All + Search */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={attendeesGuestTypeTab === 'host' ? selectAllHost : selectAllExternal}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    indeterminate={
                      attendeesSelectedIds.size > 0 && attendeesSelectedIds.size < attendeesMasterGuests.length
                    }
                  />
                }
                label={<Typography variant="body2" fontWeight={600}>Select All</Typography>}
              />
              
              <TextField
                size="small"
                placeholder="Search by name, gender, company, country, title, or rank..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                sx={{ width: 400 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>

            {/* Guest List */}
            {attendeesMasterGuests.length === 0 ? (
              <Box 
                sx={{ 
                  p: 6, 
                  bgcolor: 'white', 
                  borderRadius: 1, 
                  border: '1px solid #ddd',
                  textAlign: 'center' 
                }}
              >
                <Typography color="text.secondary">
                  No {attendeesGuestTypeTab === 'host' ? 'host' : 'external'} guests in master list.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Add guests to the master list first.
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  maxHeight: 450,
                  overflowY: 'auto',
                  bgcolor: 'white',
                  borderRadius: 1,
                  border: '1px solid #ddd',
                }}
              >
                {/* Sortable Header Row */}
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderBottom: '2px solid #ddd',
                    bgcolor: '#f5f5f5',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <Box sx={{ width: 42 }} /> {/* Checkbox space */}
                  {COLUMNS.map((col) => (
                    <Box
                      key={col.field}
                      onClick={() => handleSortClick(col.field, false)}
                      sx={{
                        minWidth: col.width,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <Typography variant="caption" fontWeight={600}>
                        {col.label}
                      </Typography>
                      {attendeesSort.field === col.field && (
                        attendeesSort.direction === 'asc' 
                          ? <ArrowUpward sx={{ fontSize: 14, ml: 0.5 }} />
                          : <ArrowDownward sx={{ fontSize: 14, ml: 0.5 }} />
                      )}
                    </Box>
                  ))}
                </Stack>

                {filteredSortedMasterGuests.length === 0 ? (
                  <Typography align="center" py={4} color="text.secondary">
                    No matching guests found.
                  </Typography>
                ) : (
                  filteredSortedMasterGuests.map((guest) => {
                    const isSelected = attendeesSelectedIds.has(guest.id);

                    return (
                      <Stack
                        key={guest.id}
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          borderBottom: '1px solid #eee',
                          cursor: 'pointer',
                          bgcolor: isSelected ? '#e3f2fd' : 'white',
                          '&:hover': {
                            bgcolor: isSelected ? '#bbdefb' : '#f9f9f9',
                          },
                        }}
                        onClick={() => handleToggleGuest(guest.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleGuest(guest.id)}
                          icon={<Circle />}
                          checkedIcon={<CheckCircle />}
                          onClick={(e) => e.stopPropagation()}
                        />

                        <Typography variant="body2" fontWeight={500} sx={{ minWidth: 180 }}>
                          {guest.salutation} {guest.name}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                          {guest.gender}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
                          {guest.company}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                          {guest.country}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
                          {guest.title}
                        </Typography>

                        <Chip 
                          label={`${guest.ranking}`} 
                          size="small" 
                          color={getRankingColor(guest.ranking)}
                          sx={{ minWidth: 70 }}
                        />
                      </Stack>
                    );
                  })
                )}
              </Box>
            )}
          </>
        )}

        {/* ===================== SEATING STATUS TAB ===================== */}
        {mainTab === 'seating' && (
          <>
            <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
              Hide guests to exclude them from auto-fill. Hidden guests can still be manually
              assigned to seats. View current seat assignments below.
            </Alert>

            {/* Guest Type Tabs (Host/External) for Seating */}
            <Tabs 
              value={seatingGuestTypeTab} 
              onChange={(_, v) => setSeatingGuestTypeTab(v)} 
              sx={{ mb: 2 }}
            >
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <span>Host Company</span>
                    <Chip 
                      label={`${hostGuests.filter(g => findGuestSeat(g.id)).length}/${hostGuests.length}`} 
                      size="small" 
                      color={hostGuests.length > 0 ? "primary" : "default"}
                    />
                  </Box>
                } 
                value="host" 
              />
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <span>External Guests</span>
                    <Chip 
                      label={`${externalGuests.filter(g => findGuestSeat(g.id)).length}/${externalGuests.length}`} 
                      size="small" 
                      color={externalGuests.length > 0 ? "primary" : "default"}
                    />
                  </Box>
                } 
                value="external" 
              />
            </Tabs>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip
                label={`${seatingActiveGuests.filter(g => !g.deleted).length} Active`}
                color="success"
                size="small"
              />
              <Chip
                label={`${seatingActiveGuests.filter(g => g.deleted).length} Hidden`}
                color="default"
                size="small"
              />
              <Chip
                label={`${seatingActiveGuests.filter(g => findGuestSeat(g.id)).length}/${seatingActiveGuests.length} Seated`}
                color="primary"
                size="small"
                variant="outlined"
              />
            </Stack>

            {/* Search */}
            <TextField
              size="small"
              fullWidth
              placeholder="Search by name, gender, company, country, title, or rank..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {seatingActiveGuests.length === 0 ? (
              <Box 
                sx={{ 
                  p: 6, 
                  bgcolor: 'white', 
                  borderRadius: 1, 
                  border: '1px solid #ddd',
                  textAlign: 'center' 
                }}
              >
                <Typography color="text.secondary">
                  No {seatingGuestTypeTab === 'host' ? 'host' : 'external'} guests in this session yet.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Select guests from the "Manage Attendees" tab first.
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  maxHeight: 450,
                  overflowY: 'auto',
                  bgcolor: 'white',
                  borderRadius: 1,
                  border: '1px solid #ddd',
                }}
              >
                {/* Sortable Header Row */}
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderBottom: '2px solid #ddd',
                    bgcolor: '#f5f5f5',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  {COLUMNS.map((col) => (
                    <Box
                      key={col.field}
                      onClick={() => handleSortClick(col.field, true)}
                      sx={{
                        minWidth: col.width,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <Typography variant="caption" fontWeight={600}>
                        {col.label}
                      </Typography>
                      {seatingSort.field === col.field && (
                        seatingSort.direction === 'asc' 
                          ? <ArrowUpward sx={{ fontSize: 14, ml: 0.5 }} />
                          : <ArrowDownward sx={{ fontSize: 14, ml: 0.5 }} />
                      )}
                    </Box>
                  ))}
                  <Typography variant="caption" fontWeight={600} sx={{ minWidth: 150 }}>
                    Seat Assignment
                  </Typography>
                  <Typography variant="caption" fontWeight={600} sx={{ minWidth: 60 }}>
                    Visible
                  </Typography>
                </Stack>

                {filteredSortedActiveGuests.length === 0 ? (
                  <Typography align="center" py={4} color="text.secondary">
                    No matching guests found.
                  </Typography>
                ) : (
                  filteredSortedActiveGuests.map((guest) => {
                    const seatInfo = getGuestSeatInfo(guest.id);
                    const isHidden = guest.deleted;

                    return (
                      <Stack
                        key={guest.id}
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{
                          p: 1.5,
                          borderBottom: '1px solid #eee',
                          opacity: isHidden ? 0.5 : 1,
                          bgcolor: isHidden ? '#fafafa' : 'white',
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          fontWeight={500} 
                          sx={{ 
                            minWidth: 180,
                            textDecoration: isHidden ? 'line-through' : 'none',
                          }}
                        >
                          {guest.salutation} {guest.name}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                          {guest.gender}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
                          {guest.company}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                          {guest.country}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>
                          {guest.title}
                        </Typography>

                        <Chip 
                          label={`${guest.ranking}`} 
                          size="small" 
                          color={getRankingColor(guest.ranking)}
                          sx={{ minWidth: 70 }}
                        />

                        <Box sx={{ minWidth: 150 }}>
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
                        </Box>

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
                      </Stack>
                    );
                  })
                )}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {mainTab === 'attendees' 
            ? `Total selected: ${totalSelected} guest${totalSelected !== 1 ? 's' : ''}`
            : `${seatedCount} of ${allActiveGuests.length} guests seated`
          }
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>
            {hasChanges ? 'Cancel' : 'Close'}
          </Button>
          {mainTab === 'attendees' && (
            <Button 
              onClick={handleSave} 
              variant="contained"
              disabled={!hasChanges}
            >
              Save Attendees
            </Button>
          )}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}