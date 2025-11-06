'use client';

import { useState } from 'react';
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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useGuestStore } from '@/store/guestStore';
import { autoFillSeats, SortField, SortDirection, SortRule, TableRules } from '@/utils/seatAutoFillHelper';

interface AutoFillModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Generate a visual pattern example for spacing rule
 */
function generateSpacingPattern(spacing: number, maxSeats: number = 8): string {
  const pattern: string[] = [];
  let seatCount = 0;
  
  while (seatCount < maxSeats) {
    pattern.push('H'); // Host
    seatCount++;
    
    if (seatCount >= maxSeats) break;
    
    for (let i = 0; i < spacing && seatCount < maxSeats; i++) {
      pattern.push('E'); // External
      seatCount++;
    }
  }
  
  return pattern.join(' → ');
}

export default function AutoFillModal({ open, onClose }: AutoFillModalProps) {
  const { hostGuests, externalGuests } = useGuestStore();

  // Guest list selection
  const [includeHost, setIncludeHost] = useState(true);
  const [includeExternal, setIncludeExternal] = useState(true);
  
  // Sorting rules
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { field: 'ranking', direction: 'asc' },
  ]);

  // Table rules - NEW
  const [tableRules, setTableRules] = useState<TableRules>({
    ratioRule: {
      enabled: false,
      hostRatio: 50,
      externalRatio: 50,
    },
    spacingRule: {
      enabled: false,
      spacing: 1,
      startWithExternal: false, // NEW
    },
  });

  const [isProcessing, setIsProcessing] = useState(false);

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

  // --- Confirm Handler ---
  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await autoFillSeats({
        includeHost,
        includeExternal,
        sortRules,
        tableRules,
      });
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Auto-Fill Seats Configuration</DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Configure guest lists, sorting rules, and table assignment rules for autofill.
          </Typography>

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

          {/* ========== TABLE RULES ========== */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: '#e3f2fd' }}>
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
              Table Assignment Rules
            </FormLabel>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Define how guests are distributed across tables
            </Typography>

            {/* Warning when both rules are enabled */}
            {tableRules.ratioRule.enabled && tableRules.spacingRule.enabled && (
              <Box sx={{ bgcolor: '#fff3e0', border: '1px solid #ff9800', p: 1.5, borderRadius: 1, mb: 2 }}>
                <Typography variant="caption" color="warning.dark">
                  ⚠️ <strong>Note:</strong> Both Ratio and Spacing rules are enabled. Spacing Rule will take priority.
                </Typography>
              </Box>
            )}

            <Stack spacing={2}>
              {/* ===== RATIO RULE ===== */}
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

                    <Box sx={{ bgcolor: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        <strong>Example:</strong> With ratio {tableRules.ratioRule.hostRatio}:
                        {tableRules.ratioRule.externalRatio}, a 12-seat table will have ~
                        {Math.round(
                          (12 * tableRules.ratioRule.hostRatio) /
                            (tableRules.ratioRule.hostRatio + tableRules.ratioRule.externalRatio)
                        )}{' '}
                        host and ~
                        {12 -
                          Math.round(
                            (12 * tableRules.ratioRule.hostRatio) /
                              (tableRules.ratioRule.hostRatio + tableRules.ratioRule.externalRatio)
                          )}{' '}
                        external guests.
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Box>

              {/* ===== SPACING RULE ===== */}
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
                  <Stack spacing={2} mt={2}>
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

                    <Box sx={{ bgcolor: '#f5f5f5', p: 1.5, borderRadius: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        <strong>Example Pattern (spacing = {tableRules.spacingRule.spacing}):</strong>
                        <br />
                        {generateSpacingPattern(tableRules.spacingRule.spacing, 8)}
                      </Typography>
                    </Box>
                  </Stack>
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
          disabled={isProcessing || (!includeHost && !includeExternal)}
        >
          {isProcessing ? 'Filling…' : 'Confirm Auto-Fill'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}