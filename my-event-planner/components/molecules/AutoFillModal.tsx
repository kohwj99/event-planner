'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  FormLabel,
  Stack,
  Typography,
  MenuItem,
  Select,
  IconButton,
  TextField,
  Box,
  Divider,
  Switch,
  Paper,
  Autocomplete,
  Chip,
  Alert,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Recommend as RecommendIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  Visibility as VisibilityIcon,
  Shuffle as ShuffleIcon,
} from '@mui/icons-material';
import { useGuestStore, Guest } from '@/store/guestStore';
import { useEventStore } from '@/store/eventStore';
import { useSeatStore } from '@/store/seatStore';
import {
  autoFillSeats,
  SortField,
  SortDirection,
  SortRule,
  TableRules,
  ProximityRules,
  RandomizePartition,
  RandomizeOrderConfig,
  isRandomizeOrderApplicable,
} from '@/utils/seatAutoFillHelper';
import {
  SessionRulesConfig,
  DEFAULT_SESSION_RULES,
  DEFAULT_RANDOMIZE_ORDER,
  StoredProximityViolation,
} from '@/types/Event';

interface AutoFillModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string | null;
  sessionId: string | null;
}

export interface SitTogetherRule {
  id: string;
  guest1Id: string;
  guest2Id: string;
  isFromRecommendation?: boolean; // Track if this came from a recommendation
}

export interface SitAwayRule {
  id: string;
  guest1Id: string;
  guest2Id: string;
}

/**
 * VIP Recommendation for sitting with tracked guest
 */
interface VIPRecommendation {
  vipGuest: Guest;
  trackedGuest: Guest;
  historicalCount: number; // How many times they've sat together before
  ranking: number;
  reason: string;
}

export default function AutoFillModal({ open, onClose, eventId, sessionId }: AutoFillModalProps) {
  const { hostGuests, externalGuests, setGuests } = useGuestStore();
  const allGuests = [...hostGuests, ...externalGuests].filter((g) => !g.deleted);

  // Event store for tracking data and session rules
  const getTrackedGuests = useEventStore((s) => s.getTrackedGuests);
  const getFilteredHistoricalAdjacencyCount = useEventStore((s) => s.getFilteredHistoricalAdjacencyCount);
  const isSessionTracked = useEventStore((s) => s.isSessionTracked);
  const getSessionById = useEventStore((s) => s.getSessionById);
  const getSessionGuests = useEventStore((s) => s.getSessionGuests);

  // Session rules methods
  const loadSessionRules = useEventStore((s) => s.loadSessionRules);
  const saveSessionRules = useEventStore((s) => s.saveSessionRules);
  const saveSessionViolations = useEventStore((s) => s.saveSessionViolations);

  // Guest list selection
  const [includeHost, setIncludeHost] = useState(true);
  const [includeExternal, setIncludeExternal] = useState(true);

  // Sorting rules
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { field: 'ranking', direction: 'asc' },
  ]);

  // Table rules
  const [tableRules, setTableRules] = useState<TableRules>({
    ratioRule: {
      enabled: false,
      hostRatio: 50,
      externalRatio: 50,
    },
    spacingRule: {
      enabled: false,
      spacing: 1,
      startWithExternal: false,
    },
  });

  // Proximity Rules
  const [sitTogetherRules, setSitTogetherRules] = useState<SitTogetherRule[]>([]);
  const [sitAwayRules, setSitAwayRules] = useState<SitAwayRule[]>([]);

  // Randomize Order Rules
  const [randomizeOrder, setRandomizeOrder] = useState<RandomizeOrderConfig>({
    enabled: false,
    partitions: [],
  });

  // VIP Recommendations UI state
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [acceptedRecommendations, setAcceptedRecommendations] = useState<Set<string>>(new Set());

  const [isProcessing, setIsProcessing] = useState(false);

  // Track the last loaded session to detect session changes
  const [lastLoadedSessionId, setLastLoadedSessionId] = useState<string | null>(null);

  // Default values - defined as constants for reuse
  const DEFAULT_SORT_RULES: SortRule[] = [{ field: 'ranking', direction: 'asc' }];
  const DEFAULT_TABLE_RULES: TableRules = {
    ratioRule: {
      enabled: false,
      hostRatio: 50,
      externalRatio: 50,
    },
    spacingRule: {
      enabled: false,
      spacing: 1,
      startWithExternal: false,
    },
  };

  // Check if randomize order section should be visible
  // Only show when there's exactly 1 sort rule that is by ranking
  const isRandomizeOrderVisible = useMemo(() => {
    return isRandomizeOrderApplicable(sortRules);
  }, [sortRules]);

  // Reset randomize order when sort rules change and it's no longer applicable
  useEffect(() => {
    if (!isRandomizeOrderVisible && randomizeOrder.enabled) {
      setRandomizeOrder({
        enabled: false,
        partitions: [],
      });
    }
  }, [isRandomizeOrderVisible, randomizeOrder.enabled]);

  // Reset all rules to defaults
  const resetToDefaults = () => {
    setIncludeHost(true);
    setIncludeExternal(true);
    setSortRules([...DEFAULT_SORT_RULES]);
    setTableRules({ ...DEFAULT_TABLE_RULES });
    setSitTogetherRules([]);
    setSitAwayRules([]);
    setRandomizeOrder({ enabled: false, partitions: [] });
    setAcceptedRecommendations(new Set());
  };

  /**
   * CRITICAL FIX: Sync guestStore with eventStore's session guests.
   * This ensures that any new guests added to the master list and inherited
   * by the session are reflected in the guestStore before autofill runs.
   */
  const syncGuestsFromSession = useCallback(() => {
    if (!sessionId) {
      console.log('syncGuestsFromSession: No session ID, skipping sync');
      return false;
    }

    const sessionGuests = getSessionGuests(sessionId);
    if (!sessionGuests) {
      console.log('syncGuestsFromSession: No session guests found, skipping sync');
      return false;
    }

    const { hostGuests: sessionHostGuests, externalGuests: sessionExternalGuests } = sessionGuests;

    console.log('syncGuestsFromSession: Syncing guests from eventStore to guestStore', {
      hostCount: sessionHostGuests.length,
      externalCount: sessionExternalGuests.length,
    });

    // Use the new setGuests function to bulk sync while preserving deleted status
    setGuests(sessionHostGuests, sessionExternalGuests);

    return true;
  }, [sessionId, getSessionGuests, setGuests]);

  // Load saved rules when modal opens with a valid session
  // This effect handles both initial load and session switching
  useEffect(() => {
    if (open && sessionId) {
      // Check if this is a different session than last time
      const isNewSession = sessionId !== lastLoadedSessionId;

      if (isNewSession) {
        // First, reset everything to defaults
        resetToDefaults();

        // Then load saved rules if they exist for THIS session
        const savedRules = loadSessionRules(sessionId);

        if (savedRules && savedRules.lastModified) {
          // Only load if rules were actually saved (have lastModified timestamp)
          console.log('Loading saved session rules for session:', sessionId, savedRules);

          // Load guest list selection
          setIncludeHost(savedRules.guestListSelection.includeHost);
          setIncludeExternal(savedRules.guestListSelection.includeExternal);

          // Load sort rules (only if non-empty)
          if (savedRules.sortRules && savedRules.sortRules.length > 0) {
            setSortRules(savedRules.sortRules);
          }

          // Load table rules
          if (savedRules.tableRules) {
            setTableRules(savedRules.tableRules);
          }

          // Load proximity rules
          if (savedRules.proximityRules) {
            // Ensure all sit-together rules have IDs
            const sitTogetherWithIds = savedRules.proximityRules.sitTogether.map((rule, idx) => ({
              ...rule,
              id: rule.id || `together-loaded-${idx}-${Date.now()}`,
            }));
            setSitTogetherRules(sitTogetherWithIds);

            // Ensure all sit-away rules have IDs
            const sitAwayWithIds = savedRules.proximityRules.sitAway.map((rule, idx) => ({
              ...rule,
              id: rule.id || `away-loaded-${idx}-${Date.now()}`,
            }));
            setSitAwayRules(sitAwayWithIds);
          }

          // Load randomize order config
          if (savedRules.randomizeOrder) {
            setRandomizeOrder(savedRules.randomizeOrder);
          }
        } else {
          console.log('No saved rules for session, using defaults:', sessionId);
          // Defaults already set by resetToDefaults() above
        }

        setLastLoadedSessionId(sessionId);
      }
    }
  }, [open, sessionId, loadSessionRules, lastLoadedSessionId]);

  // Reset lastLoadedSessionId when modal closes so it reloads fresh next time
  useEffect(() => {
    if (!open) {
      setLastLoadedSessionId(null);
    }
  }, [open]);

  // Build guest lookup
  const guestLookup = useMemo(() => {
    const lookup: Record<string, Guest> = {};
    allGuests.forEach(g => {
      lookup[g.id] = g;
    });
    return lookup;
  }, [allGuests]);

  // Calculate VIP recommendations based on adjacency history
  const vipRecommendations = useMemo((): VIPRecommendation[] => {
    if (!eventId || !sessionId) return [];

    // Check if this session is tracked
    const sessionTracked = isSessionTracked(eventId, sessionId);
    if (!sessionTracked) return [];

    const trackedGuestIds = getTrackedGuests(eventId);
    if (trackedGuestIds.length === 0) return [];

    const recommendations: VIPRecommendation[] = [];

    trackedGuestIds.forEach(trackedGuestId => {
      const trackedGuest = guestLookup[trackedGuestId];
      if (!trackedGuest) return;

      // Get opposite type VIPs (ranking 1-4)
      // If tracked is host, get external VIPs; if tracked is external, get host VIPs
      const oppositeVIPs = allGuests.filter(g =>
        g.fromHost !== trackedGuest.fromHost &&
        g.ranking >= 1 &&
        g.ranking <= 4 &&
        !g.deleted
      );

      if (oppositeVIPs.length === 0) return;

      // Get historical adjacency data for this tracked guest
      const historicalData = getFilteredHistoricalAdjacencyCount(
        eventId,
        sessionId,
        trackedGuestId,
        trackedGuest.fromHost
      );

      // Build recommendations for each VIP
      oppositeVIPs.forEach(vip => {
        const historyData = historicalData[vip.id];
        const historicalCount = historyData?.count || 0;

        recommendations.push({
          vipGuest: vip,
          trackedGuest: trackedGuest,
          historicalCount,
          ranking: vip.ranking,
          reason: historicalCount === 0
            ? 'Never sat together before'
            : `Sat together ${historicalCount} time${historicalCount > 1 ? 's' : ''} before`,
        });
      });
    });

    // Sort recommendations:
    // 1. By ranking (lower ranking = higher priority, 1 at top)
    // 2. By historical count (fewer times = higher priority to even out)
    return recommendations.sort((a, b) => {
      // First by ranking (ascending - 1 is highest priority)
      if (a.ranking !== b.ranking) {
        return a.ranking - b.ranking;
      }
      // Then by historical count (ascending - fewer times = higher priority)
      return a.historicalCount - b.historicalCount;
    });
  }, [eventId, sessionId, allGuests, guestLookup, getTrackedGuests, getFilteredHistoricalAdjacencyCount, isSessionTracked]);

  // Get unique recommendation key
  const getRecommendationKey = (rec: VIPRecommendation) =>
    `${rec.trackedGuest.id}-${rec.vipGuest.id}`;

  // Accept a recommendation (creates a sit-together rule)
  const acceptRecommendation = (rec: VIPRecommendation) => {
    const key = getRecommendationKey(rec);

    // Check if rule already exists
    const ruleExists = sitTogetherRules.some(
      rule =>
        (rule.guest1Id === rec.trackedGuest.id && rule.guest2Id === rec.vipGuest.id) ||
        (rule.guest1Id === rec.vipGuest.id && rule.guest2Id === rec.trackedGuest.id)
    );

    if (!ruleExists) {
      setSitTogetherRules([
        ...sitTogetherRules,
        {
          id: `rec-${Date.now()}-${key}`,
          guest1Id: rec.trackedGuest.id,
          guest2Id: rec.vipGuest.id,
          isFromRecommendation: true,
        },
      ]);
    }

    setAcceptedRecommendations(prev => new Set(prev).add(key));
  };

  // Reject/remove a recommendation
  const rejectRecommendation = (rec: VIPRecommendation) => {
    const key = getRecommendationKey(rec);

    // Remove from accepted set
    setAcceptedRecommendations(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    // Remove corresponding sit-together rule if it was from this recommendation
    setSitTogetherRules(prev =>
      prev.filter(rule =>
        !((rule.guest1Id === rec.trackedGuest.id && rule.guest2Id === rec.vipGuest.id) ||
          (rule.guest1Id === rec.vipGuest.id && rule.guest2Id === rec.trackedGuest.id))
      )
    );
  };

  // Check if recommendation is accepted
  const isRecommendationAccepted = (rec: VIPRecommendation) =>
    acceptedRecommendations.has(getRecommendationKey(rec));

  // --- Sorting Rules Handlers ---
  const addSortRule = () => setSortRules([...sortRules, { field: 'name', direction: 'asc' }]);
  const removeSortRule = (index: number) => setSortRules(sortRules.filter((_, i) => i !== index));
  const updateSortRule = (index: number, field: keyof SortRule, value: any) => {
    const updated = [...sortRules];
    (updated[index] as any)[field] = value;
    setSortRules(updated);
  };

  // --- Table Rules Handlers ---
  const toggleRatioRule = () => {
    setTableRules({
      ...tableRules,
      ratioRule: {
        ...tableRules.ratioRule,
        enabled: !tableRules.ratioRule.enabled,
      },
    });
  };

  const updateRatioValues = (host: number, external: number) => {
    setTableRules({
      ...tableRules,
      ratioRule: {
        ...tableRules.ratioRule,
        hostRatio: Math.max(0, host),
        externalRatio: Math.max(0, external),
      },
    });
  };

  // --- Proximity Rules Handlers ---
  const addSitTogetherRule = () => {
    setSitTogetherRules([
      ...sitTogetherRules,
      { id: `together-${Date.now()}`, guest1Id: '', guest2Id: '' },
    ]);
  };

  const removeSitTogetherRule = (id: string) => {
    setSitTogetherRules(sitTogetherRules.filter((r) => r.id !== id));
  };

  const updateSitTogetherRule = (id: string, field: 'guest1Id' | 'guest2Id', value: string) => {
    setSitTogetherRules(
      sitTogetherRules.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const addSitAwayRule = () => {
    setSitAwayRules([
      ...sitAwayRules,
      { id: `away-${Date.now()}`, guest1Id: '', guest2Id: '' },
    ]);
  };

  const removeSitAwayRule = (id: string) => {
    setSitAwayRules(sitAwayRules.filter((r) => r.id !== id));
  };

  const updateSitAwayRule = (id: string, field: 'guest1Id' | 'guest2Id', value: string) => {
    setSitAwayRules(
      sitAwayRules.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // --- Randomize Order Handlers ---
  const toggleRandomizeOrder = () => {
    setRandomizeOrder({
      ...randomizeOrder,
      enabled: !randomizeOrder.enabled,
    });
  };

  const addRandomizePartition = () => {
    const newPartition: RandomizePartition = {
      id: `partition-${Date.now()}`,
      minRank: 1,
      maxRank: 4,
    };
    setRandomizeOrder({
      ...randomizeOrder,
      partitions: [...randomizeOrder.partitions, newPartition],
    });
  };

  const removeRandomizePartition = (id: string) => {
    setRandomizeOrder({
      ...randomizeOrder,
      partitions: randomizeOrder.partitions.filter(p => p.id !== id),
    });
  };

  const updateRandomizePartition = (id: string, field: 'minRank' | 'maxRank', value: number) => {
    setRandomizeOrder({
      ...randomizeOrder,
      partitions: randomizeOrder.partitions.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    });
  };

  // Validate rules
  const getValidationErrors = (): string[] => {
    const errors: string[] = [];

    // Check for incomplete rules
    sitTogetherRules.forEach((rule, idx) => {
      if (!rule.guest1Id || !rule.guest2Id) {
        errors.push(`Sit Together Rule ${idx + 1}: Both guests must be selected`);
      } else if (rule.guest1Id === rule.guest2Id) {
        errors.push(`Sit Together Rule ${idx + 1}: Cannot select the same guest twice`);
      }
    });

    sitAwayRules.forEach((rule, idx) => {
      if (!rule.guest1Id || !rule.guest2Id) {
        errors.push(`Sit Away Rule ${idx + 1}: Both guests must be selected`);
      } else if (rule.guest1Id === rule.guest2Id) {
        errors.push(`Sit Away Rule ${idx + 1}: Cannot select the same guest twice`);
      }
    });

    // Check for conflicting rules
    sitTogetherRules.forEach((togetherRule) => {
      sitAwayRules.forEach((awayRule) => {
        if (
          (togetherRule.guest1Id === awayRule.guest1Id && togetherRule.guest2Id === awayRule.guest2Id) ||
          (togetherRule.guest1Id === awayRule.guest2Id && togetherRule.guest2Id === awayRule.guest1Id)
        ) {
          const guest1 = allGuests.find(g => g.id === togetherRule.guest1Id);
          const guest2 = allGuests.find(g => g.id === togetherRule.guest2Id);
          errors.push(`Conflicting rules: ${guest1?.name} and ${guest2?.name} have both Sit Together and Sit Away rules`);
        }
      });
    });

    // Validate randomize partitions
    if (randomizeOrder.enabled && isRandomizeOrderVisible) {
      randomizeOrder.partitions.forEach((partition, idx) => {
        if (partition.minRank >= partition.maxRank) {
          errors.push(`Randomize Partition ${idx + 1}: Min rank must be less than max rank`);
        }
        if (partition.minRank < 1) {
          errors.push(`Randomize Partition ${idx + 1}: Min rank must be at least 1`);
        }
      });

      // Check for overlapping partitions
      for (let i = 0; i < randomizeOrder.partitions.length; i++) {
        for (let j = i + 1; j < randomizeOrder.partitions.length; j++) {
          const p1 = randomizeOrder.partitions[i];
          const p2 = randomizeOrder.partitions[j];
          // Check if ranges overlap: [p1.min, p1.max) and [p2.min, p2.max)
          if (p1.minRank < p2.maxRank && p2.minRank < p1.maxRank) {
            errors.push(`Randomize Partitions ${i + 1} and ${j + 1} overlap`);
          }
        }
      }
    }

    return errors;
  };

  const validationErrors = getValidationErrors();

  // Build the current rules config for saving
  const buildCurrentRulesConfig = (): SessionRulesConfig => {
    return {
      guestListSelection: {
        includeHost,
        includeExternal,
      },
      sortRules: sortRules,
      tableRules: tableRules,
      proximityRules: {
        sitTogether: sitTogetherRules.filter(r => r.guest1Id && r.guest2Id),
        sitAway: sitAwayRules.filter(r => r.guest1Id && r.guest2Id),
      },
      randomizeOrder: randomizeOrder,
    };
  };

  // --- Confirm Handler ---
  const handleConfirm = async () => {
    if (validationErrors.length > 0) {
      return;
    }

    setIsProcessing(true);
    try {
      // CRITICAL FIX: Sync guests from eventStore to guestStore before autofill
      // This ensures any newly added guests to the master list that were inherited
      // by this session are reflected in the guestStore that autoFillSeats reads from
      console.log('AutoFillModal: Syncing guests before autofill...');
      syncGuestsFromSession();

      // Small delay to ensure state has propagated
      await new Promise(resolve => setTimeout(resolve, 50));

      const proximityRules: ProximityRules = {
        sitTogether: sitTogetherRules.filter(r => r.guest1Id && r.guest2Id),
        sitAway: sitAwayRules.filter(r => r.guest1Id && r.guest2Id),
      };

      await autoFillSeats({
        includeHost,
        includeExternal,
        sortRules,
        tableRules,
        proximityRules,
        randomizeOrder: isRandomizeOrderVisible ? randomizeOrder : undefined,
      });

      // After autofill completes, save the rules and violations to the session
      if (eventId && sessionId) {
        const sessionData = getSessionById(sessionId);
        if (sessionData) {
          const { dayId } = sessionData;

          // Build and save the rules config
          const rulesConfig = buildCurrentRulesConfig();
          saveSessionRules(eventId, dayId, sessionId, rulesConfig);

          // Get current violations from seatStore and save them
          const currentViolations = useSeatStore.getState().violations;
          const storedViolations: StoredProximityViolation[] = currentViolations.map(v => ({
            type: v.type,
            guest1Id: v.guest1Id,
            guest2Id: v.guest2Id,
            guest1Name: v.guest1Name,
            guest2Name: v.guest2Name,
            tableId: v.tableId,
            tableLabel: v.tableLabel,
            seat1Id: v.seat1Id,
            seat2Id: v.seat2Id,
            reason: v.reason,
          }));
          saveSessionViolations(eventId, dayId, sessionId, storedViolations);

          console.log('Saved session rules and violations:', { rulesConfig, violations: storedViolations.length });
        }
      }
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  // Get color for ranking badge
  const getRankingColor = (ranking: number): 'error' | 'warning' | 'info' | 'default' => {
    if (ranking === 1) return 'error';
    if (ranking === 2) return 'warning';
    if (ranking === 3) return 'info';
    return 'default';
  };

  // Check if current session has saved rules (for UI indicator)
  const sessionHasSavedRules = useMemo(() => {
    if (!sessionId) return false;
    const savedRules = loadSessionRules(sessionId);
    return savedRules && savedRules.lastModified;
  }, [sessionId, loadSessionRules]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Auto-Fill Seats Configuration</Typography>
          {sessionId && sessionHasSavedRules && (
            <Chip
              label="Rules loaded from session"
              size="small"
              color="info"
              variant="outlined"
            />
          )}
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert severity="error">
              <Typography variant="subtitle2" gutterBottom>Please fix the following errors:</Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validationErrors.map((error, idx) => (
                  <li key={idx}><Typography variant="caption">{error}</Typography></li>
                ))}
              </ul>
            </Alert>
          )}


          {/* ========== GUEST LIST SELECTION ========== */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
              Guest Lists
            </FormLabel>
            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeHost}
                    onChange={(e) => setIncludeHost(e.target.checked)}
                  />
                }
                label={`Host Guests (${hostGuests.filter(g => !g.deleted).length})`}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeExternal}
                    onChange={(e) => setIncludeExternal(e.target.checked)}
                  />
                }
                label={`External Guests (${externalGuests.filter(g => !g.deleted).length})`}
              />
            </Stack>
          </Paper>

          <Divider />

          {/* ========== SORTING RULES ========== */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
              Sorting Priority
            </FormLabel>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Define the order in which guests are considered for seating. First rule has highest priority.
            </Typography>

            <Stack spacing={1}>
              {sortRules.map((rule, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ width: 24 }}>
                    {idx + 1}.
                  </Typography>
                  <Select
                    size="small"
                    value={rule.field}
                    onChange={(e) => updateSortRule(idx, 'field', e.target.value)}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="ranking">Ranking</MenuItem>
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="country">Country</MenuItem>
                    <MenuItem value="organization">Organization</MenuItem>
                  </Select>
                  <Select
                    size="small"
                    value={rule.direction}
                    onChange={(e) => updateSortRule(idx, 'direction', e.target.value)}
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                  </Select>
                  <IconButton onClick={() => removeSortRule(idx)} size="small" disabled={sortRules.length <= 1}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={addSortRule}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Sort Rule
              </Button>
            </Stack>
          </Paper>

          {/* ========== RANDOMIZE ORDER ========== */}
          {isRandomizeOrderVisible && (
            <>
              <Divider />
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f3e5f5', border: randomizeOrder.enabled ? '2px solid #9c27b0' : '1px solid #e0e0e0' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ShuffleIcon color={randomizeOrder.enabled ? 'secondary' : 'disabled'} />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={600} color={randomizeOrder.enabled ? 'secondary.dark' : 'text.secondary'}>
                        Randomize Order
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Shuffle guests within rank ranges for varied arrangements
                      </Typography>
                    </Box>
                  </Stack>
                  <Switch
                    checked={randomizeOrder.enabled}
                    onChange={toggleRandomizeOrder}
                    color="secondary"
                  />
                </Stack>

                {randomizeOrder.enabled && (
                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                      Define rank partitions to randomize. Guests within each partition will be shuffled randomly
                      while maintaining their group position relative to other ranks.
                      <br />
                      <strong>Formula:</strong> minRank ≤ rank &lt; maxRank
                    </Typography>

                    <Stack spacing={1.5}>
                      {randomizeOrder.partitions.map((partition, idx) => (
                        <Stack
                          key={partition.id}
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{
                            p: 1.5,
                            bgcolor: 'white',
                            borderRadius: 1,
                            border: '1px solid #ce93d8',
                          }}
                        >
                          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                            Partition {idx + 1}:
                          </Typography>
                          <TextField
                            size="small"
                            type="number"
                            label="Min Rank (≥)"
                            value={partition.minRank}
                            onChange={(e) => updateRandomizePartition(partition.id, 'minRank', Math.round(parseFloat(e.target.value) * 10) / 10  || 1)}
                            inputProps={{ min: 0, max: 9 }}
                            sx={{ width: 110 }}
                          />
                          <Typography variant="body2" color="text.secondary">to</Typography>
                          <TextField
                            size="small"
                            type="number"
                            label="Max Rank (<)"
                            value={partition.maxRank}
                            onChange={(e) => updateRandomizePartition(partition.id, 'maxRank', Math.round(parseFloat(e.target.value) * 10) / 10 || 2)}
                            inputProps={{ min: 2, max: 10 }}
                            sx={{ width: 110 }}
                          />
                          <Tooltip title={`Randomize guests with rank ${partition.minRank} to ${partition.maxRank - 1}`}>
                            <Chip
                              label={`Rank ${partition.minRank}-${partition.maxRank - 0.1 }`}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          </Tooltip>
                          <IconButton
                            onClick={() => removeRandomizePartition(partition.id)}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}

                      <Button
                        variant="outlined"
                        size="small"
                        color="secondary"
                        startIcon={<AddIcon />}
                        onClick={addRandomizePartition}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Add Partition
                      </Button>

                      {randomizeOrder.partitions.length === 0 && (
                        <Alert severity="info" sx={{ mt: 1 }}>
                          Add partitions to randomize guest order within specific rank ranges.
                          For example, add a partition with min=1, max=4 to shuffle all VIP guests (ranks 1-3).
                        </Alert>
                      )}
                    </Stack>
                  </Box>
                )}
              </Paper>
            </>
          )}

          <Divider />


          {/* ========== VIP RECOMMENDATIONS ========== */}
          {vipRecommendations.length > 0 && (
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <RecommendIcon color="warning" />
                  <Typography variant="subtitle1" fontWeight={600} color="warning.dark">
                    VIP Seating Recommendations
                  </Typography>
                  <Chip
                    label={`${acceptedRecommendations.size} accepted`}
                    size="small"
                    color="success"
                    sx={{ ml: 1 }}
                  />
                </Stack>
                <Switch
                  checked={showRecommendations}
                  onChange={(e) => setShowRecommendations(e.target.checked)}
                  size="small"
                />
              </Stack>

              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Based on Boss Adjacency tracking, these VIP guests are recommended to sit with tracked guests.
                VIPs are sorted by ranking (higher rank first) then by fewer past adjacencies (to even out exposure).
                Click to accept and create a Sit Together rule.
              </Typography>

              {showRecommendations && (
                <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto' }}>
                  {vipRecommendations.map((rec) => {
                    const isAccepted = isRecommendationAccepted(rec);
                    const key = getRecommendationKey(rec);

                    return (
                      <Box
                        key={key}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.5,
                          bgcolor: isAccepted ? '#e8f5e9' : 'white',
                          border: isAccepted ? '2px solid #4caf50' : '1px solid #e0e0e0',
                          borderRadius: 1,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: isAccepted ? '#c8e6c9' : '#f5f5f5',
                          },
                        }}
                        onClick={() => isAccepted ? rejectRecommendation(rec) : acceptRecommendation(rec)}
                      >
                        <Stack direction="row" spacing={2} alignItems="center" flexGrow={1}>
                          {/* VIP Guest Info */}
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
                            <Chip
                              icon={<StarIcon sx={{ fontSize: 14 }} />}
                              label={`Rank ${rec.ranking}`}
                              size="small"
                              color={getRankingColor(rec.ranking)}
                              sx={{ fontWeight: 600 }}
                            />
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {rec.vipGuest.salutation} {rec.vipGuest.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {rec.vipGuest.company} - {rec.vipGuest.fromHost ? 'Host' : 'External'}
                              </Typography>
                            </Box>
                          </Stack>

                          {/* Arrow */}
                          <Typography variant="body2" color="text.secondary">
                            --
                          </Typography>

                          {/* Tracked Guest Info */}
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
                            <VisibilityIcon fontSize="small" color="primary" />
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {rec.trackedGuest.salutation} {rec.trackedGuest.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {rec.trackedGuest.company} - Tracked
                              </Typography>
                            </Box>
                          </Stack>

                          {/* History Info */}
                          <Tooltip title={rec.reason}>
                            <Chip
                              label={rec.historicalCount === 0 ? 'New' : `${rec.historicalCount}x before`}
                              size="small"
                              color={rec.historicalCount === 0 ? 'success' : rec.historicalCount >= 2 ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </Tooltip>
                        </Stack>

                        {/* Accept/Reject Indicator */}
                        {isAccepted ? (
                          <CheckCircleIcon color="success" />
                        ) : (
                          <AddIcon color="action" />
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}

              {acceptedRecommendations.size > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {acceptedRecommendations.size} recommendation{acceptedRecommendations.size > 1 ? 's' : ''} accepted.
                  These will be added as Sit Together rules below.
                </Alert>
              )}
            </Paper>
          )}

          {/* No recommendations info */}
          {eventId && sessionId && vipRecommendations.length === 0 && isSessionTracked(eventId, sessionId) && (
            <Alert severity="info" icon={<RecommendIcon />}>
              No VIP recommendations available. Make sure you have:
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                <li>Tracked guests marked in the event</li>
                <li>VIP guests (ranking 1-4) of the opposite type</li>
              </ul>
            </Alert>
          )}

          <Divider />

          {/* ========== PROXIMITY RULES ========== */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
              Proximity Rules
            </FormLabel>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Define which guests should or should not sit together
            </Typography>

            {/* Sit Together Rules */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Sit Together Rules
              </Typography>

              <Stack spacing={1}>
                {sitTogetherRules.map((rule) => (
                  <Stack
                    key={rule.id}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      border: rule.isFromRecommendation ? '2px solid #4caf50' : '1px solid #4caf50',
                      p: 1,
                      borderRadius: 1,
                      bgcolor: rule.isFromRecommendation ? '#e8f5e9' : 'white'
                    }}
                  >
                    <Autocomplete
                      size="small"
                      options={allGuests}
                      getOptionLabel={(guest) => `${guest.name} (${guest.company})`}
                      value={allGuests.find(g => g.id === rule.guest1Id) || null}
                      onChange={(_, guest) => updateSitTogetherRule(rule.id, 'guest1Id', guest?.id || '')}
                      renderInput={(params) => <TextField {...params} placeholder="Select Guest 1" />}
                      sx={{ flex: 1 }}
                    />
                    <Typography variant="body2">+</Typography>
                    <Autocomplete
                      size="small"
                      options={allGuests}
                      getOptionLabel={(guest) => `${guest.name} (${guest.company})`}
                      value={allGuests.find(g => g.id === rule.guest2Id) || null}
                      onChange={(_, guest) => updateSitTogetherRule(rule.id, 'guest2Id', guest?.id || '')}
                      renderInput={(params) => <TextField {...params} placeholder="Select Guest 2" />}
                      sx={{ flex: 1 }}
                    />
                    {rule.isFromRecommendation && (
                      <Chip label="VIP Rec" size="small" color="success" variant="outlined" />
                    )}
                    <IconButton onClick={() => removeSitTogetherRule(rule.id)} size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addSitTogetherRule}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add Sit Together Rule
                </Button>
              </Stack>
            </Box>

            {/* Sit Away Rules */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Sit Away Rules
              </Typography>

              <Stack spacing={1}>
                {sitAwayRules.map((rule) => (
                  <Stack
                    key={rule.id}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ border: '1px solid #f44336', p: 1, borderRadius: 1, bgcolor: 'white' }}
                  >
                    <Autocomplete
                      size="small"
                      options={allGuests}
                      getOptionLabel={(guest) => `${guest.name} (${guest.company})`}
                      value={allGuests.find(g => g.id === rule.guest1Id) || null}
                      onChange={(_, guest) => updateSitAwayRule(rule.id, 'guest1Id', guest?.id || '')}
                      renderInput={(params) => <TextField {...params} placeholder="Select Guest 1" />}
                      sx={{ flex: 1 }}
                    />
                    <Typography variant="body2">X</Typography>
                    <Autocomplete
                      size="small"
                      options={allGuests}
                      getOptionLabel={(guest) => `${guest.name} (${guest.company})`}
                      value={allGuests.find(g => g.id === rule.guest2Id) || null}
                      onChange={(_, guest) => updateSitAwayRule(rule.id, 'guest2Id', guest?.id || '')}
                      renderInput={(params) => <TextField {...params} placeholder="Select Guest 2" />}
                      sx={{ flex: 1 }}
                    />
                    <IconButton onClick={() => removeSitAwayRule(rule.id)} size="small" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addSitAwayRule}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add Sit Away Rule
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Divider />

          {/* ========== TABLE RULES ========== */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
              Table Assignment Rules
            </FormLabel>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Define how guests are distributed across tables
            </Typography>

            <Stack spacing={2}>
              {/* Ratio Rule */}
              <Box
                sx={{
                  border: tableRules.ratioRule.enabled ? '2px solid #1976d2' : '1px solid #ddd',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'white',
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Ratio Rule
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Maintain a specific ratio of host to external guests per table
                    </Typography>
                  </Box>
                  <Switch
                    checked={tableRules.ratioRule.enabled}
                    onChange={toggleRatioRule}
                    color="primary"
                  />
                </Stack>

                {tableRules.ratioRule.enabled && (
                  <Stack spacing={2} mt={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <TextField
                        label="Host Ratio"
                        type="number"
                        size="small"
                        value={tableRules.ratioRule.hostRatio}
                        onChange={(e) =>
                          updateRatioValues(
                            parseInt(e.target.value) || 0,
                            tableRules.ratioRule.externalRatio
                          )
                        }
                        inputProps={{ min: 0, max: 100 }}
                        sx={{ width: 120 }}
                      />
                      <Typography variant="h6" color="text.secondary">
                        :
                      </Typography>
                      <TextField
                        label="External Ratio"
                        type="number"
                        size="small"
                        value={tableRules.ratioRule.externalRatio}
                        onChange={(e) =>
                          updateRatioValues(
                            tableRules.ratioRule.hostRatio,
                            parseInt(e.target.value) || 0
                          )
                        }
                        inputProps={{ min: 0, max: 100 }}
                        sx={{ width: 120 }}
                      />
                    </Stack>
                  </Stack>
                )}
              </Box>

              {/* Spacing Rule */}
              <Box
                sx={{
                  border: tableRules.spacingRule.enabled ? '2px solid #1976d2' : '1px solid #ddd',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'white',
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Spacing Rule
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Interleave host guests with a specified number of external guests
                    </Typography>
                  </Box>
                  <Switch
                    checked={tableRules.spacingRule.enabled}
                    onChange={() =>
                      setTableRules({
                        ...tableRules,
                        spacingRule: {
                          ...tableRules.spacingRule,
                          enabled: !tableRules.spacingRule.enabled,
                        },
                      })
                    }
                    color="primary"
                  />
                </Stack>

                {tableRules.spacingRule.enabled && (
                  <TextField
                    label="External Guests Between Hosts"
                    type="number"
                    size="small"
                    value={tableRules.spacingRule.spacing}
                    onChange={(e) =>
                      setTableRules({
                        ...tableRules,
                        spacingRule: {
                          ...tableRules.spacingRule,
                          spacing: Math.max(1, parseInt(e.target.value) || 1),
                        },
                      })
                    }
                    inputProps={{ min: 1, max: 10 }}
                    sx={{ width: 250 }}
                    helperText="Number of external guests between each host guest"
                  />
                )}
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConfirm}
          disabled={isProcessing || (!includeHost && !includeExternal) || validationErrors.length > 0}
        >
          {isProcessing ? 'Fillingâ€¦' : 'Confirm Auto-Fill'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}