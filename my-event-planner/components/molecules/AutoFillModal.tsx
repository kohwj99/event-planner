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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useGuestStore } from '@/store/guestStore';
import { autoFillSeats, SortField, SortDirection,SortRule } from '@/utils/seatAutoFillHelper';

interface AutoFillModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AutoFillModal({ open, onClose }: AutoFillModalProps) {
  const { hostGuests, externalGuests } = useGuestStore();

  const [includeHost, setIncludeHost] = useState(true);
  const [includeExternal, setIncludeExternal] = useState(true);
  const [sortRules, setSortRules] = useState<SortRule[]>([
    { field: 'ranking', direction: 'asc' }, // default
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  // ---- Add or remove sorting rules ----
  const addRule = () => setSortRules([...sortRules, { field: 'name', direction: 'asc' }]);
  const removeRule = (index: number) =>
    setSortRules(sortRules.filter((_, i) => i !== index));

  // ---- Update a rule ----
  const updateRule = (index: number, field: keyof SortRule, value: any) => {
    const updated = [...sortRules];
    (updated[index] as any)[field] = value;
    setSortRules(updated);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await autoFillSeats({
        includeHost,
        includeExternal,
        sortRules,
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
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Select guest lists to include and define how guests are ordered for autofill.
          </Typography>

          {/* Guest list selection */}
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

          {/* Sorting rules */}
          <div>
            <FormLabel component="legend">Sorting Rules (Priority Order)</FormLabel>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {sortRules.map((rule, index) => (
                <Stack
                  key={index}
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ border: '1px solid #ddd', p: 1, borderRadius: 1 }}
                >
                  <Typography variant="body2" sx={{ minWidth: 80 }}>
                    Rule {index + 1}
                  </Typography>

                  <Select
                    size="small"
                    value={rule.field}
                    onChange={(e) => updateRule(index, 'field', e.target.value as SortField)}
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

              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={addRule}
              >
                Add Rule
              </Button>
            </Stack>
          </div>
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
