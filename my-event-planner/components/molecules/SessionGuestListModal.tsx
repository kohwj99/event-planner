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

// Common styles for truncated text cells
const truncatedCellSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// Helper component for truncated text with tooltip
function TruncatedCell({ 
  text, 
  width, 
  fontWeight = 400, 
  color = 'text.secondary',
  textDecoration,
}: { 
  text: string; 
  width: number; 
  fontWeight?: number; 
  color?: string;
  textDecoration?: string;
}) {
  return (
    <Tooltip title={text || ''} placement="top" arrow enterDelay={500}>
      <Typography
        variant="body2"
        fontWeight={fontWeight}
        color={color}
        sx={{
          width,
          maxWidth: width,
          flexShrink: 0,
          ...truncatedCellSx,
          textDecoration,
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}

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

  // Current seating tab data - from guest store (active in planner)
  const seatingActiveGuests = seatingGuestTypeTab === 'host' ? hostGuests : externalGuests;

  // Filter and sort master guests for attendees tab
  const filteredSortedMasterGuests = useMemo(() => {
    let result = attendeesMasterGuests;
    
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(g => 
        (g.name ?? '').toLowerCase().includes(q) ||
        (g.gender ?? '').toLowerCase().includes(q) ||
        (g.company ?? '').toLowerCase().includes(q) ||
        (g.country ?? '').toLowerCase().includes(q) ||
        (g.title ?? '').toLowerCase().includes(q) ||
        String(g.ranking ?? '').includes(q)
      );
    }
    
    return sortGuests(result, attendeesSort);
  }, [attendeesMasterGuests, filter, attendeesSort]);

  // Filter and sort active guests for seating tab
  const filteredSortedActiveGuests = useMemo(() => {
    let result = seatingActiveGuests;
    
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(g => 
        (g.name ?? '').toLowerCase().includes(q) ||
        (g.gender ?? '').toLowerCase().includes(q) ||
        (g.company ?? '').toLowerCase().includes(q) ||
        (g.country ?? '').toLowerCase().includes(q) ||
        (g.title ?? '').toLowerCase().includes(q) ||
        String(g.ranking ?? '').includes(q)
      );
    }
    
    return sortGuests(result, seatingSort);
  }, [seatingActiveGuests, filter, seatingSort]);

  // Toggle individual guest selection
  const handleToggleGuest = (guestId: string) => {
    const setSelected = attendeesGuestTypeTab === 'host' ? setSelectedHostIds : setSelectedExternalIds;
    const selected = attendeesGuestTypeTab === 'host' ? selectedHostIds : selectedExternalIds;
    const masterList = attendeesGuestTypeTab === 'host' ? event.masterHostGuests : event.masterExternalGuests;
    const setSelectAll = attendeesGuestTypeTab === 'host' ? setSelectAllHost : setSelectAllExternal;
    
    const newSelected = new Set(selected);
    if (newSelected.has(guestId)) {
      newSelected.delete(guestId);
    } else {
      newSelected.add(guestId);
    }
    
    setSelected(newSelected);
    setSelectAll(newSelected.size === masterList.length);
    setHasChanges(true);
  };

  // Select/deselect all
  const handleSelectAll = (checked: boolean) => {
    const setSelected = attendeesGuestTypeTab === 'host' ? setSelectedHostIds : setSelectedExternalIds;
    const masterList = attendeesGuestTypeTab === 'host' ? event.masterHostGuests : event.masterExternalGuests;
    const setSelectAllState = attendeesGuestTypeTab === 'host' ? setSelectAllHost : setSelectAllExternal;
    
    if (checked) {
      setSelected(new Set(masterList.map(g => g.id)));
    } else {
      setSelected(new Set());
    }
    
    setSelectAllState(checked);
    setHasChanges(true);
  };

  // Save changes
  const handleSave = () => {
    setSessionGuests(
      eventId,
      dayId,
      sessionId,
      Array.from(selectedHostIds),
      Array.from(selectedExternalIds)
    );
    
    // Sync to guest store
    resetGuests();
    
    // Add selected host guests
    event.masterHostGuests
      .filter(g => selectedHostIds.has(g.id))
      .forEach(g => addGuest({ ...g, fromHost: true }));
    
    // Add selected external guests
    event.masterExternalGuests
      .filter(g => selectedExternalIds.has(g.id))
      .forEach(g => addGuest({ ...g, fromHost: false }));
    
    setHasChanges(false);
  };

  // Toggle guest visibility (hide/show from auto-fill)
  const handleToggleVisibility = (guestId: string) => {
    const guest = allActiveGuests.find(g => g.id === guestId);
    if (guest) {
      updateGuest(guestId, { deleted: !guest.deleted });
    }
  };

  // Calculate stats
  const totalSelected = selectedHostIds.size + selectedExternalIds.size;
  const seatedCount = allActiveGuests.filter(g => findGuestSeat(g.id)).length;

  // Ranking color helper
  const getRankingColor = (ranking: number): 'error' | 'warning' | 'primary' | 'default' => {
    if (ranking <= 2) return 'error';
    if (ranking <= 4) return 'warning';
    if (ranking <= 6) return 'primary';
    return 'default';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Session Guest List</Typography>
            <Typography variant="body2" color="text.secondary">
              {sessionName}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip 
              icon={<Groups />} 
              label={`${totalSelected} Attendees`} 
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

      <DialogContent dividers sx={{ bgcolor: '#fafafa', p: 0 }}>
        {/* Main Tabs */}
        <Tabs 
          value={mainTab} 
          onChange={(_, v) => { setMainTab(v); setFilter(''); }}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', px: 2 }}
        >
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

        {/* Attendees Tab */}
        {mainTab === 'attendees' && (
          <Box sx={{ p: 2 }}>
            {/* Guest Type Tabs */}
            <Tabs 
              value={attendeesGuestTypeTab} 
              onChange={(_, v) => setAttendeesGuestTypeTab(v)}
              sx={{ mb: 2 }}
            >
              <Tab 
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>Host Company</span>
                    <Chip 
                      label={`${selectedHostIds.size}/${event.masterHostGuests.length}`}
                      size="small"
                      color={selectedHostIds.size > 0 ? 'primary' : 'default'}
                    />
                  </Stack>
                } 
                value="host" 
              />
              <Tab 
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>External Guests</span>
                    <Chip 
                      label={`${selectedExternalIds.size}/${event.masterExternalGuests.length}`}
                      size="small"
                      color={selectedExternalIds.size > 0 ? 'primary' : 'default'}
                    />
                  </Stack>
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
                  overflowX: 'auto',
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
                    minWidth: 'fit-content',
                  }}
                >
                  <Box sx={{ width: 42, flexShrink: 0 }} /> {/* Checkbox space */}
                  {COLUMNS.map((col) => (
                    <Box
                      key={col.field}
                      onClick={() => handleSortClick(col.field, false)}
                      sx={{
                        width: col.width,
                        maxWidth: col.width,
                        flexShrink: 0,
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
                    const fullName = `${guest.salutation} ${guest.name}`.trim();

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
                          minWidth: 'fit-content',
                          '&:hover': {
                            bgcolor: isSelected ? '#bbdefb' : '#f9f9f9',
                          },
                        }}
                        onClick={() => handleToggleGuest(guest.id)}
                      >
                        <Box sx={{ width: 42, flexShrink: 0 }}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleGuest(guest.id)}
                            icon={<Circle />}
                            checkedIcon={<CheckCircle />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Box>

                        <TruncatedCell 
                          text={fullName} 
                          width={180} 
                          fontWeight={500} 
                          color="text.primary" 
                        />

                        <TruncatedCell 
                          text={guest.gender || ''} 
                          width={80} 
                        />

                        <TruncatedCell 
                          text={guest.company || ''} 
                          width={150} 
                        />

                        <TruncatedCell 
                          text={guest.country || ''} 
                          width={100} 
                        />

                        <TruncatedCell 
                          text={guest.title || ''} 
                          width={150} 
                        />

                        <Box sx={{ width: 70, maxWidth: 70, flexShrink: 0 }}>
                          <Chip 
                            label={`${guest.ranking}`} 
                            size="small" 
                            color={getRankingColor(guest.ranking)}
                          />
                        </Box>
                      </Stack>
                    );
                  })
                )}
              </Box>
            )}
          </Box>
        )}

        {/* Seating Status Tab */}
        {mainTab === 'seating' && (
          <>
            {/* Guest Type Tabs for Seating */}
            <Tabs 
              value={seatingGuestTypeTab} 
              onChange={(_, v) => setSeatingGuestTypeTab(v)}
              sx={{ px: 2, pt: 2 }}
            >
              <Tab 
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>Host Company</span>
                    <Chip 
                      label={hostGuests.filter(g => !g.deleted).length}
                      size="small"
                      color="primary"
                    />
                  </Stack>
                } 
                value="host" 
              />
              <Tab 
                label={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <span>External Guests</span>
                    <Chip 
                      label={externalGuests.filter(g => !g.deleted).length}
                      size="small"
                      color="primary"
                    />
                  </Stack>
                } 
                value="external" 
              />
            </Tabs>

            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Tip:</strong> Use the visibility toggle to hide guests from auto-fill. 
                  Hidden guests won't be automatically assigned but can still be manually seated.
                </Typography>
              </Alert>

              {/* Status chips */}
              <Stack direction="row" spacing={1} mb={2}>
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
                    overflowX: 'auto',
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
                      minWidth: 'fit-content',
                    }}
                  >
                    {COLUMNS.map((col) => (
                      <Box
                        key={col.field}
                        onClick={() => handleSortClick(col.field, true)}
                        sx={{
                          width: col.width,
                          maxWidth: col.width,
                          flexShrink: 0,
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
                    <Typography 
                      variant="caption" 
                      fontWeight={600} 
                      sx={{ width: 150, maxWidth: 150, flexShrink: 0 }}
                    >
                      Seat Assignment
                    </Typography>
                    <Typography 
                      variant="caption" 
                      fontWeight={600} 
                      sx={{ width: 60, maxWidth: 60, flexShrink: 0, textAlign: 'center' }}
                    >
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
                      const fullName = `${guest.salutation} ${guest.name}`.trim();
                      const seatLabel = seatInfo ? `${seatInfo.tableName} - Seat ${seatInfo.seatNumber}` : '';

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
                            minWidth: 'fit-content',
                          }}
                        >
                          <TruncatedCell 
                            text={fullName} 
                            width={180} 
                            fontWeight={500} 
                            color="text.primary"
                            textDecoration={isHidden ? 'line-through' : undefined}
                          />

                          <TruncatedCell 
                            text={guest.gender || ''} 
                            width={80} 
                          />

                          <TruncatedCell 
                            text={guest.company || ''} 
                            width={150} 
                          />

                          <TruncatedCell 
                            text={guest.country || ''} 
                            width={100} 
                          />

                          <TruncatedCell 
                            text={guest.title || ''} 
                            width={150} 
                          />

                          <Box sx={{ width: 70, maxWidth: 70, flexShrink: 0 }}>
                            <Chip 
                              label={`${guest.ranking}`} 
                              size="small" 
                              color={getRankingColor(guest.ranking)}
                            />
                          </Box>

                          <Box sx={{ width: 150, maxWidth: 150, flexShrink: 0 }}>
                            {seatInfo ? (
                              <Tooltip title={seatLabel} placement="top" arrow>
                                <Chip
                                  icon={<EventSeat />}
                                  label={seatLabel}
                                  size="small"
                                  color="success"
                                  sx={{
                                    maxWidth: '100%',
                                    '& .MuiChip-label': {
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    },
                                  }}
                                />
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Not seated
                              </Typography>
                            )}
                          </Box>

                          <Box sx={{ width: 60, maxWidth: 60, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
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
                          </Box>
                        </Stack>
                      );
                    })
                  )}
                </Box>
              )}
            </Box>
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