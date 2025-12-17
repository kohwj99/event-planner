// components/molecules/MealPlanModal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Box,
  Divider,
  Alert,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Save,
  Cancel,
  DragIndicator,
  Restaurant,
} from '@mui/icons-material';
import { Guest } from '@/store/guestStore';

interface MealPlanModalProps {
  open: boolean;
  onClose: () => void;
  guest: Guest | null;
  onSave: (guestId: string, mealPlans: string[]) => void;
}

export default function MealPlanModal({
  open,
  onClose,
  guest,
  onSave,
}: MealPlanModalProps) {
  const [mealPlans, setMealPlans] = useState<string[]>([]);
  const [newMealPlan, setNewMealPlan] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Initialize meal plans when guest changes
  useEffect(() => {
    if (guest && open) {
      setMealPlans(guest.mealPlans || []);
      setNewMealPlan('');
      setEditingIndex(null);
      setEditValue('');
    }
  }, [guest, open]);

  const handleAddMealPlan = () => {
    if (newMealPlan.trim()) {
      setMealPlans([...mealPlans, newMealPlan.trim()]);
      setNewMealPlan('');
    }
  };

  const handleDeleteMealPlan = (index: number) => {
    setMealPlans(mealPlans.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(mealPlans[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const updated = [...mealPlans];
      updated[editingIndex] = editValue.trim();
      setMealPlans(updated);
      setEditingIndex(null);
      setEditValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const updated = [...mealPlans];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      setMealPlans(updated);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < mealPlans.length - 1) {
      const updated = [...mealPlans];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      setMealPlans(updated);
    }
  };

  const handleSave = () => {
    if (guest) {
      onSave(guest.id, mealPlans);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddMealPlan();
    }
  };

  if (!guest) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Restaurant color="primary" />
          <Box>
            <Typography variant="h6">Meal Plans</Typography>
            <Typography variant="body2" color="text.secondary">
              {guest.name}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Add New Meal Plan */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Add New Meal Plan
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder="Enter meal plan (e.g., Vegetarian, Halal, etc.)"
              value={newMealPlan}
              onChange={(e) => setNewMealPlan(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddMealPlan}
              disabled={!newMealPlan.trim()}
            >
              Add
            </Button>
          </Stack>
        </Paper>

        <Divider sx={{ my: 2 }} />

        {/* Meal Plans List */}
        <Typography variant="subtitle2" gutterBottom>
          Current Meal Plans ({mealPlans.length})
        </Typography>

        {mealPlans.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No meal plans assigned. Add meal plans above.
          </Alert>
        ) : (
          <List dense>
            {mealPlans.map((plan, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: index % 2 === 0 ? '#fafafa' : 'white',
                  borderRadius: 1,
                  mb: 0.5,
                }}
              >
                {editingIndex === index ? (
                  <Stack direction="row" spacing={1} sx={{ width: '100%' }} alignItems="center">
                    <TextField
                      size="small"
                      fullWidth
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <IconButton size="small" color="primary" onClick={handleSaveEdit}>
                      <Save />
                    </IconButton>
                    <IconButton size="small" onClick={handleCancelEdit}>
                      <Cancel />
                    </IconButton>
                  </Stack>
                ) : (
                  <>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <IconButton
                        size="small"
                        disabled={index === 0}
                        onClick={() => handleMoveUp(index)}
                        sx={{ opacity: index === 0 ? 0.3 : 1 }}
                      >
                        <DragIndicator sx={{ transform: 'rotate(90deg)', fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography
                            variant="caption"
                            sx={{
                              bgcolor: 'primary.main',
                              color: 'white',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              fontWeight: 'bold',
                            }}
                          >
                            {index + 1}
                          </Typography>
                          <Typography variant="body2">{plan}</Typography>
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => handleStartEdit(index)}
                        sx={{ mr: 0.5 }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteMealPlan(index)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}