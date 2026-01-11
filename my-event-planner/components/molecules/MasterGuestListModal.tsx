// components/molecules/MasterGuestListModal.tsx
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
  Tooltip, Grid
} from '@mui/material';
import { useState, useMemo, useCallback } from 'react';
import { Guest } from '@/store/guestStore';
import { useEventStore } from '@/store/eventStore';
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
  Restaurant,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import MealPlanModal from './MealPlanModal';

const salutations = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];
const genders = ['Male', 'Female', 'Other'];
const countries = ['Singapore', 'USA', 'UK', 'China', 'India', 'Japan', 'Australia'];

// Define the known/required columns
const KNOWN_COLUMNS = ['name', 'salutation', 'gender', 'country', 'company', 'title', 'ranking'];

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
  const toggleGuestTracking = useEventStore((s) => s.toggleGuestTracking);
  const isGuestTracked = useEventStore((s) => s.isGuestTracked);
  const getTrackedGuests = useEventStore((s) => s.getTrackedGuests);

  const [tab, setTab] = useState<'host' | 'external'>('host');
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Guest>>({});

  // Meal Plan Modal state
  const [mealPlanModalOpen, setMealPlanModalOpen] = useState(false);
  const [selectedGuestForMealPlan, setSelectedGuestForMealPlan] = useState<Guest | null>(null);

  const [addForm, setAddForm] = useState<Omit<Guest, 'id' | 'fromHost'>>({
    name: '',
    gender: 'Male',
    salutation: 'Mr.',
    country: 'Singapore',
    company: '',
    title: '',
    ranking: 10,
    mealPlans: [],
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

  // Calculate max meal plans across all guests for display
  const maxMealPlans = useMemo(() => {
    const allGuests = [...(event?.masterHostGuests || []), ...(event?.masterExternalGuests || [])];
    let max = 0;
    allGuests.forEach(g => {
      if (g.mealPlans && g.mealPlans.length > max) {
        max = g.mealPlans.length;
      }
    });
    return max;
  }, [event]);

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
            const guests = parseGuestData(results.data, results.meta.fields || []);
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

    // Get headers from the first row
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
    const headers = jsonData[0] as string[];

    // Convert to objects with headers
    const dataWithHeaders = XLSX.utils.sheet_to_json(firstSheet) as any[];

    const guests = parseGuestData(dataWithHeaders, headers);
    importGuests(guests);
  };

  /**
   * Parse guest data from uploaded file
   * Any columns after Ranking are treated as Meal Plan 1, 2, 3, etc.
   */
  const parseGuestData = (data: any[], headers: string[]): Omit<Guest, 'id' | 'fromHost'>[] => {
    // Normalize headers to lowercase for comparison
    const normalizedHeaders = headers.map(h => (h || '').toLowerCase().trim());

    // Find the index of the Ranking column
    const rankingIndex = normalizedHeaders.findIndex(h => h === 'ranking');

    // Get additional columns after Ranking (these are meal plans)
    const mealPlanHeaders: string[] = [];
    if (rankingIndex !== -1) {
      for (let i = rankingIndex + 1; i < headers.length; i++) {
        if (headers[i] && headers[i].trim()) {
          mealPlanHeaders.push(headers[i]);
        }
      }
    }

    return data.map((row: any) => {
      // Extract meal plans from additional columns
      const mealPlans: string[] = [];
      mealPlanHeaders.forEach((header) => {
        const value = row[header] || row[header.toLowerCase()] || '';
        if (value && String(value).trim()) {
          mealPlans.push(String(value).trim());
        } else {
          // Keep empty string to maintain order
          mealPlans.push('');
        }
      });

      // Filter out trailing empty meal plans but keep ones in between
      let lastNonEmptyIndex = -1;
      for (let i = mealPlans.length - 1; i >= 0; i--) {
        if (mealPlans[i]) {
          lastNonEmptyIndex = i;
          break;
        }
      }
      const trimmedMealPlans = lastNonEmptyIndex >= 0
        ? mealPlans.slice(0, lastNonEmptyIndex + 1)
        : [];

      return {
        name: row.Name || row.name || '',
        salutation: row.Salutation || row.salutation || 'Mr.',
        gender: (row.Gender || row.gender || 'Male') as Guest['gender'],
        country: row.Country || row.country || 'Singapore',
        company: row.Company || row.company || '',
        title: row.Title || row.title || '',
        ranking: parseInt(row.Ranking || row.ranking || '10', 10),
        mealPlans: trimmedMealPlans,
      };
    }).filter(g => g.name.trim() !== '');
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
        'Meal Plan 1': 'Vegetarian',
        'Meal Plan 2': 'No Nuts',
        'Meal Plan 3': '',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Guest List Template');
    XLSX.writeFile(wb, `guest_list_template_${tab}.xlsx`);
  };

  const handleExportCurrent = () => {
    if (guests.length === 0) return;

    // Find max meal plans to create consistent columns
    let maxMealPlansInExport = 0;
    guests.forEach(g => {
      if (g.mealPlans && g.mealPlans.length > maxMealPlansInExport) {
        maxMealPlansInExport = g.mealPlans.length;
      }
    });

    const exportData = guests.map(g => {
      const base: any = {
        Name: g.name,
        Salutation: g.salutation,
        Gender: g.gender,
        Country: g.country,
        Company: g.company,
        Title: g.title,
        Ranking: g.ranking,
      };

      // Add meal plan columns
      for (let i = 0; i < maxMealPlansInExport; i++) {
        base[`Meal Plan ${i + 1}`] = g.mealPlans?.[i] || '';
      }

      return base;
    });

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
      mealPlans: [],
    });
  };

  /* -------------------- 🗑️ DELETE GUEST -------------------- */
  const handleDeleteGuest = (guestId: string) => {
    const listKey = fromHost ? 'masterHostGuests' : 'masterExternalGuests';
    const updatedList = guests.filter(g => g.id !== guestId);

    updateEventDetails(eventId, {
      [listKey]: updatedList,
    });
  };

  /* -------------------- 🍽️ MEAL PLAN HANDLERS -------------------- */
  const handleOpenMealPlanModal = (guest: Guest) => {
    setSelectedGuestForMealPlan(guest);
    setMealPlanModalOpen(true);
  };

  const handleSaveMealPlans = (guestId: string, mealPlans: string[]) => {
    const listKey = fromHost ? 'masterHostGuests' : 'masterExternalGuests';
    const updatedList = guests.map(g =>
      g.id === guestId ? { ...g, mealPlans } : g
    );

    updateEventDetails(eventId, {
      [listKey]: updatedList,
    });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">Master Guest List - {event.name}</Typography>
              {trackedCount > 0 && (
                <Typography variant="caption" color="primary">
                  {trackedCount} guest{trackedCount > 1 ? 's' : ''} tracked for Boss Adjacency
                </Typography>
              )}
              {maxMealPlans > 0 && (
                <Typography variant="caption" color="secondary" sx={{ ml: 2 }}>
                  • Up to {maxMealPlans} meal plan{maxMealPlans > 1 ? 's' : ''} imported
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
              Required columns: Name, Salutation, Gender, Country, Company, Title, Ranking
            </Typography>
            <Typography variant="caption" display="block" color="primary">
              💡 Any columns after Ranking will be imported as Meal Plan 1, 2, 3, etc.
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Add Guest Form */}
          {/* Add Guest Form - Styled to match Dashboard Reference */}
          <Box
            mb={4}
            p={3}
            sx={{
              bgcolor: 'white',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              transition: '0.3s',
              '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }
            }}
          >
            <Typography variant="subtitle1" fontWeight="700" color="text.primary" gutterBottom>
              Add New Guest
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the details below to manually add a guest to the {tab} list.
            </Typography>

            <Grid container spacing={2}>
              {/* Row 1: Personal Details */}
              <Grid size={{ xs: 12, sm: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Salutation"
                  select
                  value={addForm.salutation}
                  onChange={(e) => setAddForm({ ...addForm, salutation: e.target.value })}
                >
                  {salutations.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Full Name"
                  placeholder="e.g. John Doe"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Gender"
                  select
                  value={addForm.gender}
                  onChange={(e) => setAddForm({ ...addForm, gender: e.target.value as Guest['gender'] })}
                >
                  {genders.map((g) => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Country"
                  select
                  value={addForm.country}
                  onChange={(e) => setAddForm({ ...addForm, country: e.target.value })}
                >
                  {countries.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Row 2: Professional Details & Actions */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Company"
                  value={addForm.company}
                  onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Job Title"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Rank (1-10)"
                  type="number"
                  value={addForm.ranking}
                  onChange={(e) =>
                    setAddForm({ ...addForm, ranking: Math.min(10, Math.max(1, Number(e.target.value))) })
                  }
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 2 }} sx={{ display: 'flex' }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddGuest}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: '600',
                    boxShadow: 'none',
                    height: 40
                  }}
                >
                  Add Guest
                </Button>
              </Grid>
            </Grid>
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

          {/* Guest List Table Header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '80px 160px 80px 100px 140px 140px 80px 100px 80px auto',
              gap: 1,
              px: 1.5,
              py: 1,
              bgcolor: '#e0e0e0',
              borderRadius: '4px 4px 0 0',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            <Typography variant="caption" fontWeight="bold">Salutation</Typography>
            <Typography variant="caption" fontWeight="bold">Name</Typography>
            <Typography variant="caption" fontWeight="bold">Gender</Typography>
            <Typography variant="caption" fontWeight="bold">Country</Typography>
            <Typography variant="caption" fontWeight="bold">Company</Typography>
            <Typography variant="caption" fontWeight="bold">Title</Typography>
            <Typography variant="caption" fontWeight="bold">Rank</Typography>
            <Typography variant="caption" fontWeight="bold">Meal Plans</Typography>
            <Typography variant="caption" fontWeight="bold">Track</Typography>
            <Typography variant="caption" fontWeight="bold">Actions</Typography>
          </Box>

          {/* Guest List Table */}
          <Box
            sx={{
              maxHeight: 400,
              overflowY: 'auto',
              bgcolor: 'white',
              borderRadius: '0 0 4px 4px',
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
                const mealPlanCount = guest.mealPlans?.filter(mp => mp).length || 0;

                return (
                  <Box
                    key={guest.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '80px 160px 80px 100px 140px 140px 80px 100px 80px auto',
                      gap: 1,
                      alignItems: 'center',
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
                          sx={{ minWidth: 70 }}
                        >
                          {salutations.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </TextField>

                        <TextField
                          size="small"
                          value={editForm.name ?? guest.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />

                        <TextField
                          size="small"
                          select
                          value={editForm.gender || guest.gender}
                          onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as Guest['gender'] })}
                        >
                          {genders.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                        </TextField>

                        <TextField
                          size="small"
                          select
                          value={editForm.country || guest.country}
                          onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                        >
                          {countries.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </TextField>

                        <TextField
                          size="small"
                          value={editForm.company ?? guest.company}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                        />

                        <TextField
                          size="small"
                          value={editForm.title ?? guest.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        />

                        <TextField
                          size="small"
                          type="number"
                          value={editForm.ranking ?? guest.ranking}
                          onChange={(e) => setEditForm({ ...editForm, ranking: Number(e.target.value) })}
                        />

                        {/* Meal Plans - not editable inline */}
                        <Chip
                          icon={<Restaurant />}
                          label={mealPlanCount}
                          size="small"
                          color={mealPlanCount > 0 ? 'success' : 'default'}
                        />

                        {/* Track toggle disabled while editing */}
                        <Box />

                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" color="primary" onClick={saveEdit}>
                            <Save />
                          </IconButton>
                          <IconButton size="small" onClick={cancelEdit}>
                            <Cancel />
                          </IconButton>
                        </Stack>
                      </>
                    ) : (
                      <>
                        <Typography variant="body2">{guest.salutation}</Typography>
                        <Typography variant="body2" fontWeight={500}>{guest.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{guest.gender}</Typography>
                        <Typography variant="body2" color="text.secondary">{guest.country}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{guest.company}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>{guest.title}</Typography>
                        <Chip
                          label={`${guest.ranking}`}
                          size="small"
                          color={guest.ranking <= 4 ? 'error' : 'default'}
                        />

                        {/* Meal Plans Button */}
                        <Tooltip title={mealPlanCount > 0 ? `${mealPlanCount} meal plan(s)` : 'No meal plans'}>
                          <Chip
                            icon={<Restaurant />}
                            label={mealPlanCount}
                            size="small"
                            color={mealPlanCount > 0 ? 'success' : 'default'}
                            onClick={() => handleOpenMealPlanModal(guest)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </Tooltip>

                        {/* Boss Adjacency Tracking Toggle */}
                        <Tooltip title={isTracked ? "Tracked for Boss Adjacency" : "Track for Boss Adjacency"}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Visibility
                              fontSize="small"
                              sx={{
                                color: isTracked ? 'primary.main' : 'text.disabled',
                                mr: 0.5
                              }}
                            />
                            <Switch
                              size="small"
                              checked={isTracked}
                              onChange={() => toggleGuestTracking(eventId, guest.id)}
                            />
                          </Box>
                        </Tooltip>

                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => startEdit(guest)}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteGuest(guest.id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </>
                    )}
                  </Box>
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

      {/* Meal Plan Modal */}
      <MealPlanModal
        open={mealPlanModalOpen}
        onClose={() => {
          setMealPlanModalOpen(false);
          setSelectedGuestForMealPlan(null);
        }}
        guest={selectedGuestForMealPlan}
        onSave={handleSaveMealPlans}
      />
    </>
  );
}