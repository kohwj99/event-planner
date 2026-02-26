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
  Collapse,
} from '@mui/material';
import { useState, useMemo, useEffect, useCallback } from 'react';
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
  FilterList,
  Clear,
} from '@mui/icons-material';
import { useEventStore } from '@/store/eventStore';
import { useGuestStore, Guest } from '@/store/guestStore';
import { useSeatStore } from '@/store/seatStore';
import TruncatedCell from '@/components/shared/atoms/TruncatedCell';

interface SessionGuestListModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  dayId: string;
  sessionId: string;
  sessionName: string;
  /** 
   * Whether to show the Seating Status tab. 
   * Set to false when opened from event page, true when opened from session page.
   * @default false
   */
  showSeatingStatus?: boolean;
}

type MainTabValue = 'attendees' | 'seating';
type GuestTypeTab = 'host' | 'external';
type SortField = 'name' | 'company' | 'country' | 'title' | 'ranking';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface RankRangeFilter {
  min: number;
  max: number;
  enabled: boolean;
}

// Column configuration for consistent ordering
const COLUMNS: { field: SortField; label: string; width: number }[] = [
  { field: 'name', label: 'Name', width: 180 },
  { field: 'company', label: 'Company', width: 150 },
  { field: 'country', label: 'Country', width: 100 },
  { field: 'title', label: 'Title', width: 150 },
  { field: 'ranking', label: 'Rank', width: 70 },
];

// Default rank range
const DEFAULT_MIN_RANK = 0;
const DEFAULT_MAX_RANK = 10;

export default function SessionGuestListModal({
  open,
  onClose,
  eventId,
  dayId,
  sessionId,
  sessionName,
  showSeatingStatus = false,
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

  // Main tab state (Attendees vs Seating Status) - always starts on attendees
  const [mainTab, setMainTab] = useState<MainTabValue>('attendees');
  
  // Guest type tab state (Host vs External) - for attendees tab
  const [attendeesGuestTypeTab, setAttendeesGuestTypeTab] = useState<GuestTypeTab>('host');
  
  // Guest type tab state (Host vs External) - for seating status tab
  const [seatingGuestTypeTab, setSeatingGuestTypeTab] = useState<GuestTypeTab>('host');
  
  // Search/filter state
  const [filter, setFilter] = useState('');
  
  // Rank range filter state for attendees tab
  const [attendeesRankFilter, setAttendeesRankFilter] = useState<RankRangeFilter>({
    min: DEFAULT_MIN_RANK,
    max: DEFAULT_MAX_RANK,
    enabled: false,
  });
  
  // Rank range filter state for seating tab
  const [seatingRankFilter, setSeatingRankFilter] = useState<RankRangeFilter>({
    min: DEFAULT_MIN_RANK,
    max: DEFAULT_MAX_RANK,
    enabled: false,
  });
  
  // Show/hide rank filter panel
  const [showAttendeesRankFilter, setShowAttendeesRankFilter] = useState(false);
  const [showSeatingRankFilter, setShowSeatingRankFilter] = useState(false);
  
  // Sort state for attendees tab - default to ranking ascending (rank 1 first)
  const [attendeesSort, setAttendeesSort] = useState<SortConfig>({ field: 'ranking', direction: 'asc' });
  
  // Sort state for seating status tab - default to ranking ascending (rank 1 first)
  const [seatingSort, setSeatingSort] = useState<SortConfig>({ field: 'ranking', direction: 'asc' });
  
  // Selection state
  const [selectedHostIds, setSelectedHostIds] = useState<Set<string>>(new Set());
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Get current session data
  const currentSession = useMemo(() => {
    if (!event) return null;
    return event.days
      .find(d => d.id === dayId)
      ?.sessions.find(s => s.id === sessionId) || null;
  }, [event, dayId, sessionId]);

  // Get the inherited guest IDs for the current session
  const inheritedHostGuestIds = useMemo(() => {
    return new Set(currentSession?.inheritedHostGuestIds || []);
  }, [currentSession]);

  const inheritedExternalGuestIds = useMemo(() => {
    return new Set(currentSession?.inheritedExternalGuestIds || []);
  }, [currentSession]);

  // FIXED: Filter guestStore guests to only show those belonging to this session
  const sessionHostGuests = useMemo(() => {
    return hostGuests.filter(g => inheritedHostGuestIds.has(g.id));
  }, [hostGuests, inheritedHostGuestIds]);

  const sessionExternalGuests = useMemo(() => {
    return externalGuests.filter(g => inheritedExternalGuestIds.has(g.id));
  }, [externalGuests, inheritedExternalGuestIds]);

  // Calculate actual rank range from guests for reference
  const getActualRankRange = useCallback((guests: Guest[]): { min: number; max: number } => {
    if (guests.length === 0) return { min: DEFAULT_MIN_RANK, max: DEFAULT_MAX_RANK };
    
    const rankings = guests
      .map(g => g.ranking ?? 999)
      .filter(r => r !== 999);
    
    if (rankings.length === 0) return { min: DEFAULT_MIN_RANK, max: DEFAULT_MAX_RANK };
    
    return {
      min: Math.min(...rankings),
      max: Math.max(...rankings),
    };
  }, []);

  // Load existing session guests when modal opens
  useEffect(() => {
    if (open && event && currentSession) {
      setSelectedHostIds(new Set(currentSession.inheritedHostGuestIds || []));
      setSelectedExternalIds(new Set(currentSession.inheritedExternalGuestIds || []));
      
      // Reset filters and state
      setHasChanges(false);
      setFilter('');
      // Always reset to attendees tab when opening
      setMainTab('attendees');
      
      // Reset rank filters to default (disabled)
      const hostRankRange = getActualRankRange(event.masterHostGuests);
      
      setAttendeesRankFilter({
        min: DEFAULT_MIN_RANK,
        max: Math.max(hostRankRange.max, DEFAULT_MAX_RANK),
        enabled: false,
      });
      setSeatingRankFilter({
        min: DEFAULT_MIN_RANK,
        max: DEFAULT_MAX_RANK,
        enabled: false,
      });
      setShowAttendeesRankFilter(false);
      setShowSeatingRankFilter(false);
    }
  }, [open, event, currentSession, getActualRankRange]);

  // Get all active guests for this session (filtered by session's inherited IDs)
  const allSessionActiveGuests = useMemo(() => {
    return [...sessionHostGuests, ...sessionExternalGuests];
  }, [sessionHostGuests, sessionExternalGuests]);

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

  // Filter guests by text search and rank range
  const filterGuests = (
    guests: Guest[], 
    searchFilter: string, 
    rankFilter: RankRangeFilter
  ): Guest[] => {
    let result = guests;
    
    // Apply text search filter
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(g => 
        (g.name ?? '').toLowerCase().includes(q) ||
        (g.company ?? '').toLowerCase().includes(q) ||
        (g.country ?? '').toLowerCase().includes(q) ||
        (g.title ?? '').toLowerCase().includes(q) ||
        String(g.ranking ?? '').includes(q)
      );
    }
    
    // Apply rank range filter if enabled
    if (rankFilter.enabled) {
      result = result.filter(g => {
        const rank = g.ranking ?? 999;
        // If min and max are the same, do exact match
        if (rankFilter.min === rankFilter.max) {
          return rank === rankFilter.min;
        }
        // Otherwise, do range match (inclusive)
        return rank >= rankFilter.min && rank <= rankFilter.max;
      });
    }
    
    return result;
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

  // Current attendees tab data - from EVENT's master guest list
  const attendeesMasterGuests = attendeesGuestTypeTab === 'host' 
    ? event.masterHostGuests 
    : event.masterExternalGuests;
  const attendeesSelectedIds = attendeesGuestTypeTab === 'host' ? selectedHostIds : selectedExternalIds;

  // Current seating tab data - FILTERED to only show this session's guests
  const seatingActiveGuests = seatingGuestTypeTab === 'host' 
    ? sessionHostGuests 
    : sessionExternalGuests;

  // Filter and sort master guests for attendees tab
  const filteredSortedMasterGuests = useMemo(() => {
    const filtered = filterGuests(attendeesMasterGuests, filter, attendeesRankFilter);
    return sortGuests(filtered, attendeesSort);
  }, [attendeesMasterGuests, filter, attendeesRankFilter, attendeesSort]);

  // Filter and sort active guests for seating tab
  const filteredSortedActiveGuests = useMemo(() => {
    const filtered = filterGuests(seatingActiveGuests, filter, seatingRankFilter);
    return sortGuests(filtered, seatingSort);
  }, [seatingActiveGuests, filter, seatingRankFilter, seatingSort]);

  // Toggle individual guest selection
  const handleToggleGuest = (guestId: string) => {
    const setSelected = attendeesGuestTypeTab === 'host' ? setSelectedHostIds : setSelectedExternalIds;
    const selected = attendeesGuestTypeTab === 'host' ? selectedHostIds : selectedExternalIds;
    
    const newSelected = new Set(selected);
    if (newSelected.has(guestId)) {
      newSelected.delete(guestId);
    } else {
      newSelected.add(guestId);
    }
    
    setSelected(newSelected);
    setHasChanges(true);
  };

  // Select all FILTERED guests (only those currently displayed)
  const handleSelectAllFiltered = (checked: boolean) => {
    const setSelected = attendeesGuestTypeTab === 'host' ? setSelectedHostIds : setSelectedExternalIds;
    const currentSelected = attendeesGuestTypeTab === 'host' ? selectedHostIds : selectedExternalIds;
    
    const filteredIds = new Set(filteredSortedMasterGuests.map(g => g.id));
    
    if (checked) {
      // Add all filtered guests to selection
      const newSelected = new Set(currentSelected);
      filteredIds.forEach(id => newSelected.add(id));
      setSelected(newSelected);
    } else {
      // Remove all filtered guests from selection
      const newSelected = new Set(currentSelected);
      filteredIds.forEach(id => newSelected.delete(id));
      setSelected(newSelected);
    }
    
    setHasChanges(true);
  };

  // Check if all filtered guests are selected
  const areAllFilteredSelected = useMemo(() => {
    if (filteredSortedMasterGuests.length === 0) return false;
    return filteredSortedMasterGuests.every(g => attendeesSelectedIds.has(g.id));
  }, [filteredSortedMasterGuests, attendeesSelectedIds]);

  // Check if some (but not all) filtered guests are selected
  const areSomeFilteredSelected = useMemo(() => {
    if (filteredSortedMasterGuests.length === 0) return false;
    const selectedCount = filteredSortedMasterGuests.filter(g => attendeesSelectedIds.has(g.id)).length;
    return selectedCount > 0 && selectedCount < filteredSortedMasterGuests.length;
  }, [filteredSortedMasterGuests, attendeesSelectedIds]);

  // Count how many filtered guests are selected
  const filteredSelectedCount = useMemo(() => {
    return filteredSortedMasterGuests.filter(g => attendeesSelectedIds.has(g.id)).length;
  }, [filteredSortedMasterGuests, attendeesSelectedIds]);

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
    const guest = allSessionActiveGuests.find(g => g.id === guestId);
    if (guest) {
      updateGuest(guestId, { deleted: !guest.deleted });
    }
  };

  // Handle rank min change for attendees
  const handleAttendeesMinRankChange = (value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setAttendeesRankFilter(prev => ({
        ...prev,
        min: numValue,
      }));
    }
  };

  // Handle rank max change for attendees
  const handleAttendeesMaxRankChange = (value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setAttendeesRankFilter(prev => ({
        ...prev,
        max: numValue,
      }));
    }
  };

  // Handle rank min change for seating
  const handleSeatingMinRankChange = (value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setSeatingRankFilter(prev => ({
        ...prev,
        min: numValue,
      }));
    }
  };

  // Handle rank max change for seating
  const handleSeatingMaxRankChange = (value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setSeatingRankFilter(prev => ({
        ...prev,
        max: numValue,
      }));
    }
  };

  // Toggle rank filter enabled state
  const toggleAttendeesRankFilter = () => {
    setAttendeesRankFilter(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  const toggleSeatingRankFilter = () => {
    setSeatingRankFilter(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  // Reset rank filter
  const resetAttendeesRankFilter = () => {
    setAttendeesRankFilter({
      min: DEFAULT_MIN_RANK,
      max: DEFAULT_MAX_RANK,
      enabled: false,
    });
  };

  const resetSeatingRankFilter = () => {
    setSeatingRankFilter({
      min: DEFAULT_MIN_RANK,
      max: DEFAULT_MAX_RANK,
      enabled: false,
    });
  };

  // Calculate stats
  const totalSelected = selectedHostIds.size + selectedExternalIds.size;
  const seatedCount = allSessionActiveGuests.filter(g => findGuestSeat(g.id)).length;

  // Check if any filter is active
  const isAttendeesFilterActive = filter.trim() !== '' || attendeesRankFilter.enabled;
  const isSeatingFilterActive = filter.trim() !== '' || seatingRankFilter.enabled;

  // Ranking color helper
  const getRankingColor = (ranking: number): 'error' | 'warning' | 'primary' | 'default' => {
    if (ranking <= 2) return 'error';
    if (ranking <= 4) return 'warning';
    if (ranking <= 6) return 'primary';
    return 'default';
  };

  // Get filter description text
  const getRankFilterDescription = (rankFilter: RankRangeFilter): string => {
    if (rankFilter.min === rankFilter.max) {
      return `Showing guests with exact rank ${rankFilter.min}`;
    }
    return `Showing guests with rank between ${rankFilter.min} and ${rankFilter.max} (inclusive)`;
  };

  // Get rank filter chip label
  const getRankFilterChipLabel = (rankFilter: RankRangeFilter): string => {
    if (rankFilter.min === rankFilter.max) {
      return `=${rankFilter.min}`;
    }
    return `${rankFilter.min}-${rankFilter.max}`;
  };

  // Rank filter component
  const RankFilterPanel = ({
    rankFilter,
    onMinChange,
    onMaxChange,
    onToggle,
    onReset,
    showPanel,
    setShowPanel,
  }: {
    rankFilter: RankRangeFilter;
    onMinChange: (value: string) => void;
    onMaxChange: (value: string) => void;
    onToggle: () => void;
    onReset: () => void;
    showPanel: boolean;
    setShowPanel: (show: boolean) => void;
  }) => (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <Button
          size="small"
          variant={rankFilter.enabled ? 'contained' : 'outlined'}
          startIcon={<FilterList />}
          onClick={() => setShowPanel(!showPanel)}
          color={rankFilter.enabled ? 'primary' : 'inherit'}
        >
          Rank Filter
          {rankFilter.enabled && (
            <Chip 
              label={getRankFilterChipLabel(rankFilter)} 
              size="small" 
              sx={{ ml: 1, height: 20 }}
              color="default"
            />
          )}
        </Button>
        {rankFilter.enabled && (
          <Tooltip title="Clear rank filter">
            <IconButton size="small" onClick={onReset}>
              <Clear fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      
      <Collapse in={showPanel}>
        <Box
          sx={{
            p: 2,
            bgcolor: 'white',
            borderRadius: 1,
            border: '1px solid #ddd',
            mb: 2,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="body2" fontWeight={600}>
              Filter by Rank Range
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={rankFilter.enabled}
                  onChange={onToggle}
                  size="small"
                />
              }
              label={
                <Typography variant="body2">
                  Enable filter
                </Typography>
              }
            />
          </Stack>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              type="number"
              label="Min Rank"
              value={rankFilter.min}
              onChange={(e) => onMinChange(e.target.value)}
              disabled={!rankFilter.enabled}
              sx={{ width: 120 }}
              inputProps={{ 
                min: 0,
                step: 0.1,
              }}
            />
            
            <Typography variant="body2" color="text.secondary">
              to
            </Typography>
            
            <TextField
              size="small"
              type="number"
              label="Max Rank"
              value={rankFilter.max}
              onChange={(e) => onMaxChange(e.target.value)}
              disabled={!rankFilter.enabled}
              sx={{ width: 120 }}
              inputProps={{ 
                min: 0,
                step: 0.1,
              }}
            />
            
            {rankFilter.enabled && rankFilter.min === rankFilter.max && (
              <Chip 
                label="Exact match" 
                size="small" 
                color="info" 
                variant="outlined"
              />
            )}
          </Stack>
          
          {rankFilter.enabled && (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ mt: 1.5, display: 'block' }}
            >
              {getRankFilterDescription(rankFilter)}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );

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
            {showSeatingStatus && (
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

      <DialogContent dividers sx={{ bgcolor: '#fafafa', p: 0 }}>
        {/* Main Tabs - Only show Seating Status tab if showSeatingStatus is true */}
        {showSeatingStatus ? (
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
        ) : (
          /* When showSeatingStatus is false, just show a header bar instead of tabs */
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', px: 2, py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PersonAdd color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                Manage Attendees
              </Typography>
            </Stack>
          </Box>
        )}

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

            {/* Search Field */}
            <TextField
              size="small"
              fullWidth
              placeholder="Search by name, company, country, title, or rank..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: filter && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setFilter('')}>
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Rank Filter Panel */}
            <RankFilterPanel
              rankFilter={attendeesRankFilter}
              onMinChange={handleAttendeesMinRankChange}
              onMaxChange={handleAttendeesMaxRankChange}
              onToggle={toggleAttendeesRankFilter}
              onReset={resetAttendeesRankFilter}
              showPanel={showAttendeesRankFilter}
              setShowPanel={setShowAttendeesRankFilter}
            />

            {/* Controls: Select All + Filter Status */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={areAllFilteredSelected}
                      onChange={(e) => handleSelectAllFiltered(e.target.checked)}
                      indeterminate={areSomeFilteredSelected}
                      disabled={filteredSortedMasterGuests.length === 0}
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight={600}>
                      Select All {isAttendeesFilterActive ? 'Filtered' : ''}
                    </Typography>
                  }
                />
                
                {isAttendeesFilterActive && (
                  <Tooltip title="Select All only affects the currently filtered/displayed guests">
                    <Chip
                      icon={<Info />}
                      label={`${filteredSelectedCount}/${filteredSortedMasterGuests.length} filtered selected`}
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  </Tooltip>
                )}
              </Stack>
              
              <Typography variant="body2" color="text.secondary">
                Showing {filteredSortedMasterGuests.length} of {attendeesMasterGuests.length} guests
              </Typography>
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
                  maxHeight: 400,
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
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No matching guests found.
                    </Typography>
                    {isAttendeesFilterActive && (
                      <Button 
                        size="small" 
                        onClick={() => {
                          setFilter('');
                          resetAttendeesRankFilter();
                        }}
                        sx={{ mt: 1 }}
                      >
                        Clear all filters
                      </Button>
                    )}
                  </Box>
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
                          text={guest.name} 
                          width={180} 
                          fontWeight={500} 
                          color="text.primary" 
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

        {/* Seating Status Tab - Only rendered if showSeatingStatus is true */}
        {showSeatingStatus && mainTab === 'seating' && (
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
                      label={sessionHostGuests.filter(g => !g.deleted).length}
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
                      label={sessionExternalGuests.filter(g => !g.deleted).length}
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

              {/* Search Field */}
              <TextField
                size="small"
                fullWidth
                placeholder="Search by name, company, country, title, or rank..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: filter && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setFilter('')}>
                        <Clear fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Rank Filter Panel for Seating */}
              <RankFilterPanel
                rankFilter={seatingRankFilter}
                onMinChange={handleSeatingMinRankChange}
                onMaxChange={handleSeatingMaxRankChange}
                onToggle={toggleSeatingRankFilter}
                onReset={resetSeatingRankFilter}
                showPanel={showSeatingRankFilter}
                setShowPanel={setShowSeatingRankFilter}
              />

              {/* Filter status for seating tab */}
              {isSeatingFilterActive && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Showing {filteredSortedActiveGuests.length} of {seatingActiveGuests.length} guests
                </Typography>
              )}

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
                    maxHeight: 400,
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
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        No matching guests found.
                      </Typography>
                      {isSeatingFilterActive && (
                        <Button 
                          size="small" 
                          onClick={() => {
                            setFilter('');
                            resetSeatingRankFilter();
                          }}
                          sx={{ mt: 1 }}
                        >
                          Clear all filters
                        </Button>
                      )}
                    </Box>
                  ) : (
                    filteredSortedActiveGuests.map((guest) => {
                      const seatInfo = getGuestSeatInfo(guest.id);
                      const isHidden = guest.deleted;
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
                            text={guest.name} 
                            width={180} 
                            fontWeight={500} 
                            color="text.primary"
                            textDecoration={isHidden ? 'line-through' : undefined}
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
          {mainTab === 'attendees' || !showSeatingStatus
            ? `Total selected: ${totalSelected} guest${totalSelected !== 1 ? 's' : ''}`
            : `${seatedCount} of ${allSessionActiveGuests.length} guests seated`
          }
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>
            {hasChanges ? 'Cancel' : 'Close'}
          </Button>
          {(mainTab === 'attendees' || !showSeatingStatus) && (
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