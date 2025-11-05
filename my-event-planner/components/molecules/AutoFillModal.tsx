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
  Divider,
  TextField,
  Box,
  Switch,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useGuestStore } from '@/store/guestStore';
import {
  autoFillSeats,
  SortField,
  SortDirection,
  SortRule,
} from '@/utils/seatAutoFillHelper';

interface AutoFillModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AutoFillModal({ open, onClose }: AutoFillModalProps) {
  const { hostGuests, externalGuests } = useGuestStore();

  const [includeHost, setIncludeHost] = useState(true);
  const [includeExternal, setIncludeExternal] = useState(true);

  // Sorting Rules
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { field: 'ranking', direction: 'asc' },
  ]);

  // Seating Rules
  const [enableRatioRule, setEnableRatioRule] = useState(false);
  const [ratioValue, setRatioValue] = useState(20);

  const [enableSpacingRule, setEnableSpacingRule] = useState(false);
  const [spacingGap, setSpacingGap] = useState(1);

  const [isProcessing, setIsProcessing] = useState(false);

  // Sorting rule CRUD
  const addRule = () =>
    setSortRules([...sortRules, { field: 'name', direction: 'asc' }]);
  const removeRule = (index: number) =>
    setSortRules(sortRules.filter((_, i) => i !== index));
  const updateRule = (index: number, field: keyof SortRule, value: any) => {
    const updated = [...sortRules];
    (updated[index] as any)[field] = value;
    setSortRules(updated);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const ruleOptions = {
        ratioRule: enableRatioRule ? { enabled: true, ratio: ratioValue } : undefined,
        spacingRule: enableSpacingRule ? { enabled: true, gap: spacingGap } : undefined,
      };

      await autoFillSeats({
        includeHost,
        includeExternal,
        sortRules,
        ruleOptions, // ✅ just the plain object
      });
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Auto-Fill Seats</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Choose which guests to include and how they should be placed across tables.
          </Typography>

          {/* Guest list selection */}
          <Box>
            <FormLabel component="legend">Guest Lists</FormLabel>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
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
          </Box>

          <Divider />

          {/* Sorting Rules */}
          <Box>
            <FormLabel component="legend">Sorting Rules (Priority Order)</FormLabel>
            <Typography variant="caption" color="text.secondary">
              Guests are sorted based on the order of these rules before applying seating rules.
            </Typography>

            <Stack spacing={1} sx={{ mt: 1 }}>
              {sortRules.map((rule, index) => (
                <Stack
                  key={index}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ border: '1px solid #ddd', p: 1.2, borderRadius: 1.5 }}
                >
                  <Typography variant="body2" sx={{ minWidth: 80 }}>
                    Rule {index + 1}
                  </Typography>

                  <Select
                    size="small"
                    value={rule.field}
                    onChange={(e) =>
                      updateRule(index, 'field', e.target.value as SortField)
                    }
                  >
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="country">Country</MenuItem>
                    <MenuItem value="organization">Organization</MenuItem>
                    <MenuItem value="ranking">Ranking (Protocol)</MenuItem>
                  </Select>

                  <Select
                    size="small"
                    value={rule.direction}
                    onChange={(e) =>
                      updateRule(index, 'direction', e.target.value as SortDirection)
                    }
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                  </Select>

                  <IconButton onClick={() => removeRule(index)} size="small" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}

              <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={addRule}>
                Add Rule
              </Button>
            </Stack>
          </Box>

          <Divider />

          {/* Seating Rules */}
          <Box>
            <FormLabel component="legend">Seating Rules (Optional)</FormLabel>
            <Typography variant="caption" color="text.secondary">
              Apply additional logic to balance and space guests across each table.
            </Typography>

            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Ratio Rule */}
              <Stack direction="row" alignItems="center" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enableRatioRule}
                      onChange={(e) => setEnableRatioRule(e.target.checked)}
                    />
                  }
                  label="Host : External Ratio"
                />
                {enableRatioRule && (
                  <TextField
                    type="number"
                    size="small"
                    label="Host %"
                    value={ratioValue}
                    onChange={(e) => setRatioValue(Number(e.target.value))}
                    inputProps={{ min: 1, max: 99 }}
                    sx={{ width: 100 }}
                  />
                )}
              </Stack>

              {/* Spacing Rule */}
              <Stack direction="row" alignItems="center" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enableSpacingRule}
                      onChange={(e) => setEnableSpacingRule(e.target.checked)}
                    />
                  }
                  label="Spread Hosts"
                />
                {enableSpacingRule && (
                  <TextField
                    type="number"
                    size="small"
                    label="Guest Gap"
                    value={spacingGap}
                    onChange={(e) => setSpacingGap(Number(e.target.value))}
                    inputProps={{ min: 1, max: 10 }}
                    sx={{ width: 120 }}
                  />
                )}
              </Stack>
            </Stack>
          </Box>
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
