import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';

export interface TableConfig {
  type: 'round' | 'rectangle';
  roundSeats?: number;
  rectangleSeats?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  quantity: number;
  label: string;
}

interface AddTableModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: TableConfig) => void;
}

export default function AddTableModal({ open, onClose, onConfirm }: AddTableModalProps) {
  const [tableConfig, setTableConfig] = useState<TableConfig>({
    type: 'round',
    roundSeats: 8,
    rectangleSeats: {
      top: 2,
      bottom: 2,
      left: 1,
      right: 1,
    },
    quantity: 1,
    label: '',
  });

  const handleConfirm = () => {
    onConfirm(tableConfig);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Table(s)</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Table Type</InputLabel>
            <Select
              value={tableConfig.type}
              label="Table Type"
              onChange={(e) =>
                setTableConfig((prev) => ({
                  ...prev,
                  type: e.target.value as 'round' | 'rectangle',
                }))
              }
            >
              <MenuItem value="round">Round</MenuItem>
              <MenuItem value="rectangle">Rectangle</MenuItem>
            </Select>
          </FormControl>

          {tableConfig.type === 'round' ? (
            <TextField
              type="number"
              label="Number of Seats"
              value={tableConfig.roundSeats}
              onChange={(e) =>
                setTableConfig((prev) => ({
                  ...prev,
                  roundSeats: Math.max(1, parseInt(e.target.value) || 1),
                }))
              }
              inputProps={{ min: 1 }}
            />
          ) : (
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Seats per side:
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  type="number"
                  label="Top"
                  value={tableConfig.rectangleSeats?.top}
                  onChange={(e) =>
                    setTableConfig((prev) => ({
                      ...prev,
                      rectangleSeats: {
                        ...prev.rectangleSeats!,
                        top: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                      },
                    }))
                  }
                  inputProps={{ min: 0, max: 10 }}
                />
                <TextField
                  type="number"
                  label="Bottom"
                  value={tableConfig.rectangleSeats?.bottom}
                  onChange={(e) =>
                    setTableConfig((prev) => ({
                      ...prev,
                      rectangleSeats: {
                        ...prev.rectangleSeats!,
                        bottom: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                      },
                    }))
                  }
                  inputProps={{ min: 0, max: 10 }}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  type="number"
                  label="Left"
                  value={tableConfig.rectangleSeats?.left}
                  onChange={(e) =>
                    setTableConfig((prev) => ({
                      ...prev,
                      rectangleSeats: {
                        ...prev.rectangleSeats!,
                        left: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                      },
                    }))
                  }
                  inputProps={{ min: 0, max: 10 }}
                />
                <TextField
                  type="number"
                  label="Right"
                  value={tableConfig.rectangleSeats?.right}
                  onChange={(e) =>
                    setTableConfig((prev) => ({
                      ...prev,
                      rectangleSeats: {
                        ...prev.rectangleSeats!,
                        right: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)),
                      },
                    }))
                  }
                  inputProps={{ min: 0, max: 10 }}
                />
              </Stack>
            </Stack>
          )}

          <TextField
            label="Table Label Prefix"
            value={tableConfig.label}
            onChange={(e) =>
              setTableConfig((prev) => ({
                ...prev,
                label: e.target.value,
              }))
            }
            helperText="A number will be appended to this prefix"
          />

          <TextField
            type="number"
            label="Quantity"
            value={tableConfig.quantity}
            onChange={(e) =>
              setTableConfig((prev) => ({
                ...prev,
                quantity: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
              }))
            }
            inputProps={{ min: 1, max: 10 }}
            helperText="Number of tables to add (max 10)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained">
          Add Table(s)
        </Button>
      </DialogActions>
    </Dialog>
  );
}