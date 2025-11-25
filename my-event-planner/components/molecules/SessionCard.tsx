import { Paper, Typography, Chip, IconButton, Box } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupsIcon from "@mui/icons-material/Groups";
import { Session } from "@/types/Event";

interface SessionCardProps {
  session: Session;
  onClick: () => void;
  onDelete: () => void;
  onManageGuests?: () => void;
}

export default function SessionCard({ session, onClick, onDelete, onManageGuests }: SessionCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const handleManageGuests = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onManageGuests) {
      onManageGuests();
    }
  };

  const totalAttendees = (session.inheritedHostGuestIds?.length || 0) + 
                         (session.inheritedExternalGuestIds?.length || 0);;

  return (
    <Paper 
      elevation={1}
      sx={{ 
        p: 2, 
        cursor: "pointer", 
        borderLeft: "4px solid #1976d2",
        position: "relative",
        "&:hover": { 
          backgroundColor: "#f0f7ff",
          "& .delete-button": {
            opacity: 1
          }
        }
      }}
      onClick={onClick}
    >
      {/* Delete Button - Shows on hover */}
      <IconButton
        className="delete-button"
        size="small"
        color="error"
        onClick={handleDelete}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          opacity: 0,
          transition: "opacity 0.2s",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 1)",
          }
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>

      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
        <Chip 
          label={session.sessionType} 
          size="small" 
          color="primary" 
          variant="outlined" 
          sx={{ fontSize: '0.7rem', height: 20 }}
        />
        
        {/* Attendee Count Badge */}
        <Chip
          icon={<GroupsIcon sx={{ fontSize: 14 }} />}
          label={totalAttendees}
          size="small"
          color={totalAttendees > 0 ? "success" : "default"}
          onClick={handleManageGuests}
          sx={{ 
            fontSize: '0.7rem', 
            height: 20,
            cursor: onManageGuests ? 'pointer' : 'default',
            '&:hover': onManageGuests ? {
              backgroundColor: 'rgba(46, 125, 50, 0.12)',
            } : {}
          }}
        />
      </Box>
      
      <Typography variant="h6" fontSize="1rem" fontWeight="bold" sx={{ pr: 4 }}>
        {session.name}
      </Typography>
      
      <div className="flex items-center gap-1 mt-1 text-gray-500">
        <AccessTimeIcon fontSize="small" sx={{ fontSize: 16 }} />
        <Typography variant="caption">
          {new Date(session.startTime).toLocaleTimeString([], {
            hour: '2-digit', 
            minute: '2-digit'
          })}
        </Typography>
      </div>

      {session.description && (
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mt: 1, fontSize: '0.85rem' }}
          noWrap
        >
          {session.description}
        </Typography>
      )}
    </Paper>
  );
}