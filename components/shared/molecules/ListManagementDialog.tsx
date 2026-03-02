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
} from '@mui/icons-material';

interface ListManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (items: string[]) => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  initialItems: string[];
  addLabel: string;
  addPlaceholder: string;
  itemsLabel: string;
  emptyMessage: string;
  addCaption?: string;
  normalize?: (value: string) => string;
  preventDuplicates?: boolean;
}

export default function ListManagementDialog({
  open,
  onClose,
  onSave,
  title,
  subtitle,
  icon,
  initialItems,
  addLabel,
  addPlaceholder,
  itemsLabel,
  emptyMessage,
  addCaption,
  normalize,
  preventDuplicates = false,
}: ListManagementDialogProps) {
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Initialize items when dialog opens or initialItems change
  useEffect(() => {
    if (open) {
      setItems(initialItems);
      setNewItem('');
      setEditingIndex(null);
      setEditValue('');
    }
  }, [open, initialItems]);

  const handleAdd = () => {
    const value = normalize ? normalize(newItem) : newItem.trim();
    if (!value) return;

    if (preventDuplicates && items.some((item) => item === value)) return;

    setItems([...items, value]);
    setNewItem('');
  };

  const handleDelete = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const value = normalize ? normalize(editValue) : editValue.trim();
    if (!value) return;

    if (
      preventDuplicates &&
      items.some((item, i) => i !== editingIndex && item === value)
    )
      return;

    const updated = [...items];
    updated[editingIndex] = value;
    setItems(updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const updated = [...items];
      [updated[index - 1], updated[index]] = [
        updated[index],
        updated[index - 1],
      ];
      setItems(updated);
    }
  };

  const handleSave = () => {
    onSave(items);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon}
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Add New Item */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {addLabel}
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder={addPlaceholder}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAdd}
              disabled={!newItem.trim()}
            >
              Add
            </Button>
          </Stack>
          {addCaption && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block' }}
            >
              {addCaption}
            </Typography>
          )}
        </Paper>

        <Divider sx={{ my: 2 }} />

        {/* Items List */}
        <Typography variant="subtitle2" gutterBottom>
          {itemsLabel} ({items.length})
        </Typography>

        {items.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            {emptyMessage}
          </Alert>
        ) : (
          <List dense>
            {items.map((item, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: index % 2 === 0 ? '#fafafa' : 'white',
                  borderRadius: 1,
                  mb: 0.5,
                }}
              >
                {editingIndex === index ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ width: '100%' }}
                    alignItems="center"
                  >
                    <TextField
                      size="small"
                      fullWidth
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                    />
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={handleSaveEdit}
                    >
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
                        <DragIndicator
                          sx={{ transform: 'rotate(90deg)', fontSize: 16 }}
                        />
                      </IconButton>
                    </Stack>
                    <ListItemText
                      primary={
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                        >
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
                          <Typography variant="body2">{item}</Typography>
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
                        onClick={() => handleDelete(index)}
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
