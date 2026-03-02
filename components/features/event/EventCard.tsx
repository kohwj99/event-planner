"use client";

import {
  Card,
  CardContent,
  CardActionArea,
  CardActions,
  Typography,
  Button,
  Box,
  Divider,
  Tooltip
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { Event } from "@/types/Event";

interface EventCardProps {
  event: Event;
  onNavigate: (id: string) => void;
  onExport: (event: Event) => void;
  onDelete: (id: string) => void;
}

export function EventCard({ event, onNavigate, onExport, onDelete }: EventCardProps) {
  const displayDate = (event.startDate || event.createdAt).split('T')[0];
  const trackedGuestCount = event.trackedGuestIds?.length || 0;

  return (
    <Card 
      elevation={0} 
      sx={{ 
        height: "100%", 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        transition: '0.3s',
        '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }
      }}
    >
      <CardActionArea 
        onClick={() => onNavigate(event.id)} 
        sx={{ flexGrow: 1, p: 1 }}
      >
        <CardContent>
          <Typography variant="h6" fontWeight="bold" color="text.primary" gutterBottom>
            {event.name}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.secondary' }}>
            <CalendarTodayIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" fontWeight="500">
              {displayDate}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ 
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word' 
            }}
          >
            {event.description || "No description provided."}
          </Typography>
        </CardContent>
      </CardActionArea>
      
      <CardActions sx={{ justifyContent: "space-between", p: 2, pt: 0 }}>
        <Tooltip title="Export event as JSON">
          <Button
            size="small"
            color="primary"
            startIcon={<FileDownloadIcon />}
            onClick={(e) => {
              e.stopPropagation();
              onExport(event);
            }}
            sx={{ textTransform: 'none' }}
          >
            Export
          </Button>
        </Tooltip>
        
        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event.id);
          }}
          sx={{ textTransform: 'none' }}
        >
          Delete
        </Button>
      </CardActions>
    </Card>
  );
}