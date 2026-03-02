"use client";

import { Box, Typography, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import FileUploadIcon from "@mui/icons-material/FileUpload";

interface EmptyEventsStateProps {
  onImport: () => void;
  onCreate: () => void;
}

export function EmptyEventsState({ onImport, onCreate }: EmptyEventsStateProps) {
  return (
    <Box 
      sx={{ 
        textAlign: 'center', 
        py: 10, 
        bgcolor: 'white', 
        borderRadius: 4, 
        border: '1px dashed grey' 
      }}
    >
      <Typography variant="h5" color="text.secondary" gutterBottom>
        No events found
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create a new event or import an existing one to get started.
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button 
          variant="outlined" 
          startIcon={<FileUploadIcon />} 
          onClick={onImport}
        >
          Import Event
        </Button>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={onCreate}
        >
          Create Event
        </Button>
      </Box>
    </Box>
  );
}