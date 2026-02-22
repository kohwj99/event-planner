// components/molecules/TagModal.tsx
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
  LocalOffer,
} from '@mui/icons-material';
import { Guest } from '@/store/guestStore';
import { toUpperCamelCase } from '@/utils/tagUtils';

interface TagModalProps {
  open: boolean;
  onClose: () => void;
  guest: Guest | null;
  onSave: (guestId: string, tags: string[]) => void;
}

export default function TagModal({
  open,
  onClose,
  guest,
  onSave,
}: TagModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Initialize tags when guest changes
  useEffect(() => {
    if (guest && open) {
      setTags(guest.tags || []);
      setNewTag('');
      setEditingIndex(null);
      setEditValue('');
    }
  }, [guest, open]);

  const handleAddTag = () => {
    const normalized = toUpperCamelCase(newTag);
    if (!normalized) return;

    // Prevent duplicates (case-insensitive after normalization)
    if (tags.some(t => t === normalized)) return;

    setTags([...tags, normalized]);
    setNewTag('');
  };

  const handleDeleteTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(tags[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const normalized = toUpperCamelCase(editValue);
    if (!normalized) return;

    // Prevent duplicates (exclude current index from check)
    if (tags.some((t, i) => i !== editingIndex && t === normalized)) return;

    const updated = [...tags];
    updated[editingIndex] = normalized;
    setTags(updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const updated = [...tags];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      setTags(updated);
    }
  };

  const handleSave = () => {
    if (guest) {
      onSave(guest.id, tags);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  if (!guest) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocalOffer color="primary" />
          <Box>
            <Typography variant="h6">Tags</Typography>
            <Typography variant="body2" color="text.secondary">
              {guest.name}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* Add New Tag */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Add New Tag
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder="Enter tag (e.g., Cybersecurity, Bahasa, etc.)"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddTag}
              disabled={!newTag.trim()}
            >
              Add
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Tags are stored in UpperCamelCase (e.g., &ldquo;machine learning&rdquo; becomes &ldquo;MachineLearning&rdquo;)
          </Typography>
        </Paper>

        <Divider sx={{ my: 2 }} />

        {/* Tags List */}
        <Typography variant="subtitle2" gutterBottom>
          Current Tags ({tags.length})
        </Typography>

        {tags.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No tags assigned. Add tags above.
          </Alert>
        ) : (
          <List dense>
            {tags.map((tag, index) => (
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
                          <Typography variant="body2">{tag}</Typography>
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
                        onClick={() => handleDeleteTag(index)}
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
