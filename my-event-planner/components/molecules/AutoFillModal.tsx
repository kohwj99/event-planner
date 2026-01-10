'use client';

import { useState, useMemo } from 'react';
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
} from '@mui/icons-material';
import { useGuestStore, Guest } from '@/store/guestStore';
import { useEventStore } from '@/store/eventStore';
import { autoFillSeats, SortField, SortDirection, SortRule, TableRules, ProximityRules } from '@/utils/seatAutoFillHelper';

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
  const { hostGuests, externalGuests } = useGuestStore();
  const allGuests = [...hostGuests, ...externalGuests].filter((g) => !g.deleted);

  // Event store for tracking data
  const getTrackedGuests = useEventStore((s) => s.getTrackedGuests);
  const getFilteredHistoricalAdjacencyCount = useEventStore((s) => s.getFilteredHistoricalAdjacencyCount);
  const isSessionTracked = useEventStore((s) => s.isSessionTracked);

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

  // VIP Recommendations UI state
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [acceptedRecommendations, setAcceptedRecommendations] = useState<Set<string>>(new Set());

  const [isProcessing, setIsProcessing] = useState(false);

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
    
    return errors;
  };

  const validationErrors = getValidationErrors();

  // --- Confirm Handler ---
  const handleConfirm = async () => {
    if (validationErrors.length > 0) {
      return;
    }
    
    setIsProcessing(true);
    try {
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
      });
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Auto-Fill Seats Configuration</DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Configure guest lists, sorting rules, table assignment rules, and proximity rules for autofill.
          </Typography>

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

          {/* ========== VIP RECOMMENDATIONS (NEW) ========== */}
          {vipRecommendations.length > 0 && (
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0', border: '2px solid #ff9800' }}>
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
                                {rec.vipGuest.company} • {rec.vipGuest.fromHost ? 'Host' : 'External'}
                              </Typography>
                            </Box>
                          </Stack>

                          {/* Arrow */}
                          <Typography variant="body2" color="text.secondary">
                            →
                          </Typography>

                          {/* Tracked Guest Info */}
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200 }}>
                            <VisibilityIcon fontSize="small" color="primary" />
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {rec.trackedGuest.salutation} {rec.trackedGuest.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {rec.trackedGuest.company} • Tracked
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
                label={`Host Guests (${hostGuests.length})`}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeExternal}
                    onChange={(e) => setIncludeExternal(e.target.checked)}
                  />
                }
                label={`External Guests (${externalGuests.length})`}
              />
            </Stack>
          </Paper>

          <Divider />

          {/* ========== SORTING RULES ========== */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
              Sorting Rules (Priority Order)
            </FormLabel>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Define how guests are ordered within their respective lists (Host/External)
            </Typography>
            
            <Stack spacing={1}>
              {sortRules.map((rule, index) => (
                <Stack
                  key={index}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ border: '1px solid #ddd', p: 1, borderRadius: 1, bgcolor: 'white' }}
                >
                  <Typography variant="body2" sx={{ minWidth: 60 }}>
                    Rule {index + 1}
                  </Typography>

                  <Select
                    size="small"
                    value={rule.field}
                    onChange={(e) => updateSortRule(index, 'field', e.target.value as SortField)}
                    sx={{ minWidth: 140 }}
                  >
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="country">Country</MenuItem>
                    <MenuItem value="organization">Organization</MenuItem>
                    <MenuItem value="ranking">Ranking (Protocol)</MenuItem>
                  </Select>

                  <Select
                    size="small"
                    value={rule.direction}
                    onChange={(e) => updateSortRule(index, 'direction', e.target.value as SortDirection)}
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                  </Select>

                  <IconButton onClick={() => removeSortRule(index)} size="small" color="error">
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
                Add Sorting Rule
              </Button>
            </Stack>
          </Paper>

          <Divider />

          {/* ========== PROXIMITY RULES ========== */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#e8f5e9' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
              Proximity Rules
            </FormLabel>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Define who should sit together or apart
            </Typography>

            {/* Sit Together Rules */}
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Typography variant="subtitle2" fontWeight={600}>
                  🤝 Sit Together Rules
                </Typography>
                {sitTogetherRules.filter(r => r.isFromRecommendation).length > 0 && (
                  <Chip 
                    label={`${sitTogetherRules.filter(r => r.isFromRecommendation).length} from recommendations`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                These guests will be seated adjacent to each other whenever possible
              </Typography>
              
              <Stack spacing={1}>
                {sitTogetherRules.map((rule) => (
                  <Stack
                    key={rule.id}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ 
                      border: rule.isFromRecommendation ? '2px solid #ff9800' : '1px solid #4caf50', 
                      p: 1, 
                      borderRadius: 1, 
                      bgcolor: rule.isFromRecommendation ? '#fff8e1' : 'white' 
                    }}
                  >
                    {rule.isFromRecommendation && (
                      <Tooltip title="From VIP Recommendation">
                        <RecommendIcon fontSize="small" color="warning" />
                      </Tooltip>
                    )}
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
                🚫 Sit Away Rules
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                These guests will never be seated adjacent to each other
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
                    <Typography variant="body2">⛔</Typography>
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
          {isProcessing ? 'Filling…' : 'Confirm Auto-Fill'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}