import { useState } from "react";
import { Paper, Typography, Button, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AddIcon from "@mui/icons-material/Add";
import { Event } from "@/types/Event";
import MasterGuestListModal from "@/components/molecules/MasterGuestListModal";

interface EventDetailHeaderProps {
  event: Event;
  onBack: () => void;
  onAddDay: () => void;
}

export default function EventDetailHeader({ 
  event, 
  onBack, 
  onAddDay 
}: EventDetailHeaderProps) {
  const [guestModalOpen, setGuestModalOpen] = useState(false);

  return (
    <>
      <Paper elevation={2} sx={{ p: 2, zIndex: 10 }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <IconButton onClick={onBack}>
              <ArrowBackIcon />
            </IconButton>
            <div>
              <Typography variant="h5" fontWeight="bold">
                {event.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {event.description}
              </Typography>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outlined" 
              startIcon={<UploadFileIcon />}
              onClick={() => setGuestModalOpen(true)}
            >
              Manage Guest Lists
            </Button>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={onAddDay}
            >
              Add Day
            </Button>
          </div>
        </div>
        
        <div className="mt-2 flex gap-4 text-sm text-gray-600">
          <span>Host Guests: {event.masterHostGuests.length}</span>
          <span>|</span>
          <span>External Guests: {event.masterExternalGuests.length}</span>
        </div>
      </Paper>

      <MasterGuestListModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        eventId={event.id}
      />
    </>
  );
}