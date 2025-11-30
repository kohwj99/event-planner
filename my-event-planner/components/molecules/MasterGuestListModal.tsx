'use client';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  MenuItem,
  InputAdornment,
  Chip,
  Alert,
  LinearProgress,
  Switch,
  Tooltip,
} from '@mui/material';
import { useState, useMemo, useCallback } from 'react';
import { Guest } from '@/store/guestStore';
import { useEventStore } from '@/store/eventStore';
import { useTrackingStore } from '@/store/trackingStore';
import { 
  Delete, 
  Search, 
  UploadFile, 
  Edit, 
  Save, 
  Cancel,
  Download,
  Add,
  Visibility,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const salutations = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];
const genders = ['Male', 'Female', 'Other'];
const countries = ['Singapore', 'USA', 'UK', 'China', 'India', 'Japan', 'Australia'];

interface MasterGuestListModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
}

export default function MasterGuestListModal({
  open,
  onClose,
  eventId,
}: MasterGuestListModalProps) {
  const event = useEventStore((s) => s.events.find(e => e.id === eventId));
  const addMasterGuest = useEventStore((s) => s.addMasterGuest);
  const updateEventDetails = useEventStore((s) => s.updateEventDetails);
  const updateEventTrackedGuests = useEventStore((s) => s.updateEventTrackedGuests);

  // Tracking Store
  const toggleGuestTracking = useTrackingStore((s) => s.toggleGuestTracking);
  const isGuestTracked = useTrackingStore((s) => s.isGuestTracked);
  const getTrackedGuests = useTrackingStore((s) => s.getTrackedGuests);

  const [tab, setTab] = useState<'host' | 'external'>('host');
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Guest>>({});
  
  const [addForm, setAddForm] = useState<Omit<Guest, 'id' | 'fromHost'>>({
    name: '',
    gender: 'Male',
    salutation: 'Mr.',
    country: 'Singapore',
    company: '',
    title: '',
    ranking: 10,
  });

  if (!event) return null;

  const guests = tab === 'host' ? event.masterHostGuests : event.masterExternalGuests;
  const fromHost = tab === 'host';

  const filteredGuests = useMemo(() => {
    if (!filter.trim()) return guests;
    const q = filter.toLowerCase();
    return guests.filter(
      (g) =>
        (g.name ?? '').toLowerCase().includes(q) ||
        (g.company ?? '').toLowerCase().includes(q) ||
        (g.title ?? '').toLowerCase().includes(q) ||
        (g.country ?? '').toLowerCase().includes(q)
    );
  }, [filter, guests]);

  const trackedCount = useMemo(() => {
    return guests.filter(g => isGuestTracked(eventId, g.id)).length;
  }, [guests, eventId, isGuestTracked]);

  /* -------------------- 📥 FILE UPLOAD HANDLERS -------------------- */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        await handleCSVUpload(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await handleExcelUpload(file);
      } else {
        setUploadError('Unsupported file format. Please upload CSV or Excel files.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to process file. Please check the format and try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCSVUpload = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const guests = parseGuestData(results.data);
            importGuests(guests);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => reject(error),
      });
    });
  };

  const handleExcelUpload = async (file: File): Promise<void> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
    
    const guests = parseGuestData(jsonData);
    importGuests(guests);
  };

  const parseGuestData = (data: any[]): Omit<Guest, 'id' | 'fromHost'>[] => {
    return data.map((row: any) => ({
      name: row.Name || row.name || '',
      salutation: row.Salutation || row.salutation || 'Mr.',
      gender: (row.Gender || row.gender || 'Male') as Guest['gender'],
      country: row.Country || row.country || 'Singapore',
      company: row.Company || row.company || '',
      title: row.Title || row.title || '',
      ranking: parseInt(row.Ranking || row.ranking || '10', 10),
    })).filter(g => g.name.trim() !== '');
  };

  const importGuests = (guestsData: Omit<Guest, 'id' | 'fromHost'>[]) => {
    guestsData.forEach((guestData) => {
      const newGuest: Guest = {
        ...guestData,
        id: uuidv4(),
        fromHost,
      };
      addMasterGuest(eventId, newGuest);
    });
  };

  /* -------------------- 📤 EXPORT TEMPLATE -------------------- */
  const handleExportTemplate = () => {
    const template = [
      {
        Name: 'John Doe',
        Salutation: 'Mr.',
        Gender: 'Male',
        Country: 'Singapore',
        Company: 'Example Corp',
        Title: 'CEO',
        Ranking: 1,
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guest List Template');
    XLSX.writeFile(wb, `guest_list_template_${tab}.xlsx`);
  };

  const handleExportCurrent = () => {
    if (guests.length === 0) return;

    const exportData = guests.map(g => ({
      Name: g.name,
      Salutation: g.salutation,
      Gender: g.gender,
      Country: g.country,
      Company: g.company,
      Title: g.title,
      Ranking: g.ranking,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === 'host' ? 'Host Guests' : 'External Guests');
    XLSX.writeFile(wb, `${tab}_guests_${event.name.replace(/\s+/g, '_')}.xlsx`);
  };

  /* -------------------- ✏️ EDIT HANDLERS -------------------- */
  const startEdit = (guest: Guest) => {
    setEditingId(guest.id);
    setEditForm({ ...guest });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editingId) return;

    const listKey = fromHost ? 'masterHostGuests' : 'masterExternalGuests';
    const updatedList = guests.map(g => 
      g.id === editingId ? { ...g, ...editForm } : g
    );

    updateEventDetails(eventId, {
      [listKey]: updatedList,
    });

    setEditingId(null);
    setEditForm({});
  };

  /* -------------------- ➕ ADD GUEST -------------------- */
  const handleAddGuest = () => {
    if (!addForm.name.trim()) return;
    
    const newGuest: Guest = {
      ...addForm,
      id: uuidv4(),
      fromHost,
    };
    
    addMasterGuest(eventId, newGuest);
    
    setAddForm({
      name: '',
      gender: 'Male',
      salutation: 'Mr.',
      country: 'Singapore',
      company: '',
      title: '',
      ranking: 10,
    });
  };

  /* -------------------- 🗑️ DELETE GUEST -------------------- */
  const handleDeleteGuest = (guestId: string) => {
    const listKey = fromHost ? 'masterHostGuests' : 'masterExternalGuests';
    const updatedList = guests.filter(g => g.id !== guestId);
    updateEventDetails(eventId, { [listKey]: updatedList });
  };

  /* -------------------- 👁️ TRACKING TOGGLE WITH PERSISTENCE -------------------- */
  const handleTrackingToggle = useCallback((guestId: string) => {
    // Toggle in tracking store (primary source of truth)
    toggleGuestTracking(eventId, guestId);
    
    // CRITICAL: Sync to event store for backup persistence
    // Use setTimeout to ensure tracking store has updated first
    setTimeout(() => {
      const updatedTrackedGuests = getTrackedGuests(eventId);
      updateEventTrackedGuests(eventId, updatedTrackedGuests);
      console.log(`🔄 Synced ${updatedTrackedGuests.length} tracked guests to event store`);
    }, 0);
  }, [eventId, toggleGuestTracking, getTrackedGuests, updateEventTrackedGuests]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Master Guest Lists - {event.name}</Typography>
            {trackedCount > 0 && (
              <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <Visibility fontSize="small" />
                {trackedCount} guest{trackedCount !== 1 ? 's' : ''} tracked for Boss Adjacency
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<Download />}
              onClick={handleExportTemplate}
              variant="outlined"
            >
              Download Template
            </Button>
            <Button
              size="small"
              startIcon={<Download />}
              onClick={handleExportCurrent}
              variant="outlined"
              disabled={guests.length === 0}
            >
              Export Current
            </Button>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: '#fafafa' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab 
            label={`Host Company (${event.masterHostGuests.length})`} 
            value="host" 
          />
          <Tab 
            label={`External Guests (${event.masterExternalGuests.length})`} 
            value="external" 
          />
        </Tabs>

        {/* Upload Section */}
        <Box mb={3}>
          <input
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            id="guest-file-upload"
            type="file"
            onChange={handleFileUpload}
          />
          <label htmlFor="guest-file-upload">
            <Button
              variant="contained"
              component="span"
              startIcon={<UploadFile />}
              disabled={uploading}
            >
              Upload Guest List (CSV/Excel)
            </Button>
          </label>
          {uploading && <LinearProgress sx={{ mt: 1 }} />}
          {uploadError && (
            <Alert severity="error" sx={{ mt: 1 }} onClose={() => setUploadError('')}>
              {uploadError}
            </Alert>
          )}
          <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
            Expected columns: Name, Salutation, Gender, Country, Company, Title, Ranking
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Add Guest Form */}
        <Box mb={2} p={2} bgcolor="white" borderRadius={1} border="1px solid #ddd">
          <Typography variant="subtitle2" mb={2} fontWeight={600}>
            Add New Guest
          </Typography>
          <Stack direction="row" flexWrap="wrap" spacing={1.5}>
            <TextField
              size="small"
              label="Salutation"
              select
              value={addForm.salutation}
              onChange={(e) => setAddForm({ ...addForm, salutation: e.target.value })}
              sx={{ minWidth: 100 }}
            >
              {salutations.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              label="Name"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              sx={{ minWidth: 180 }}
            />

            <TextField
              size="small"
              label="Gender"
              select
              value={addForm.gender}
              onChange={(e) => setAddForm({ ...addForm, gender: e.target.value as Guest['gender'] })}
              sx={{ minWidth: 100 }}
            >
              {genders.map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              label="Country"
              select
              value={addForm.country}
              onChange={(e) => setAddForm({ ...addForm, country: e.target.value })}
              sx={{ minWidth: 140 }}
            >
              {countries.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              label="Company"
              value={addForm.company}
              onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
              sx={{ minWidth: 180 }}
            />

            <TextField
              size="small"
              label="Title"
              value={addForm.title}
              onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
              sx={{ minWidth: 180 }}
            />

            <TextField
              size="small"
              label="Ranking"
              type="number"
              value={addForm.ranking}
              onChange={(e) =>
                setAddForm({ ...addForm, ranking: Math.min(10, Math.max(1, Number(e.target.value))) })
              }
              sx={{ minWidth: 100 }}
            />

            <Button
              variant="contained"
              onClick={handleAddGuest}
              startIcon={<Add />}
              sx={{ height: 40 }}
            >
              Add
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Filter & Stats */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <TextField
            size="small"
            placeholder="Search guests..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Showing {filteredGuests.length} of {guests.length} guests
          </Typography>
        </Stack>

        {/* Guest List Table */}
        <Box
          sx={{
            maxHeight: 500,
            overflowY: 'auto',
            bgcolor: 'white',
            borderRadius: 1,
            border: '1px solid #ddd',
          }}
        >
          {guests.length === 0 ? (
            <Typography align="center" py={6} color="text.secondary">
              No guests yet. Add guests manually or upload a file.
            </Typography>
          ) : filteredGuests.length === 0 ? (
            <Typography align="center" py={4} color="text.secondary">
              No matching guests found.
            </Typography>
          ) : (
            filteredGuests.map((guest) => {
              const isEditing = editingId === guest.id;
              const isTracked = isGuestTracked(eventId, guest.id);

              return (
                <Stack
                  key={guest.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid #eee',
                    bgcolor: isTracked ? '#f0f7ff' : 'transparent',
                    '&:hover': { bgcolor: isTracked ? '#e3f2fd' : '#f9f9f9' },
                  }}
                >
                  {isEditing ? (
                    <>
                      <TextField
                        size="small"
                        select
                        value={editForm.salutation || guest.salutation}
                        onChange={(e) => setEditForm({ ...editForm, salutation: e.target.value })}
                        sx={{ minWidth: 80 }}
                      >
                        {salutations.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                      </TextField>

                      <TextField
                        size="small"
                        value={editForm.name ?? guest.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        sx={{ minWidth: 160 }}
                      />

                      <TextField
                        size="small"
                        select
                        value={editForm.gender || guest.gender}
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as Guest['gender'] })}
                        sx={{ minWidth: 100 }}
                      >
                        {genders.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                      </TextField>

                      <TextField
                        size="small"
                        select
                        value={editForm.country || guest.country}
                        onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                        sx={{ minWidth: 120 }}
                      >
                        {countries.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </TextField>

                      <TextField
                        size="small"
                        value={editForm.company ?? guest.company}
                        onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                        sx={{ minWidth: 160 }}
                      />

                      <TextField
                        size="small"
                        value={editForm.title ?? guest.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        sx={{ minWidth: 160 }}
                      />

                      <TextField
                        size="small"
                        type="number"
                        value={editForm.ranking ?? guest.ranking}
                        onChange={(e) => setEditForm({ ...editForm, ranking: Number(e.target.value) })}
                        sx={{ minWidth: 80 }}
                      />

                      <IconButton size="small" color="primary" onClick={saveEdit}>
                        <Save />
                      </IconButton>
                      <IconButton size="small" onClick={cancelEdit}>
                        <Cancel />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ minWidth: 80 }}>
                        {guest.salutation}
                      </Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ minWidth: 160 }}>
                        {guest.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                        {guest.gender}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                        {guest.country}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>
                        {guest.company}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>
                        {guest.title}
                      </Typography>
                      <Chip
                        label={`Rank ${guest.ranking}`}
                        size="small"
                        color={guest.ranking <= 4 ? 'error' : 'default'}
                        sx={{ minWidth: 80 }}
                      />

                      <Box flexGrow={1} />

                      {/* Boss Adjacency Tracking Toggle */}
                      <Tooltip title={isTracked ? "Tracked for Boss Adjacency" : "Track for Boss Adjacency"}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Visibility fontSize="small" sx={{ color: isTracked ? 'primary.main' : 'text.disabled' }} />
                          <Switch
                            size="small"
                            checked={isTracked}
                            onChange={() => handleTrackingToggle(guest.id)}
                            color="primary"
                          />
                        </Box>
                      </Tooltip>

                      <IconButton size="small" onClick={() => startEdit(guest)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteGuest(guest.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </Stack>
              );
            })
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}