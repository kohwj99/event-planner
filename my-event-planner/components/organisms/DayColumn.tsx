import { Paper, Typography, Button, Box, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { EventDay } from "@/types/Event";
import SessionCard from "@/components/molecules/SessionCard";

interface DayColumnProps {
  day: EventDay;
  dayIndex: number;
  onAddSession: (dayId: string) => void;
  onDeleteDay: (dayId: string, dayIndex: number, sessionCount: number) => void;
  onDeleteSession: (sessionId: string, sessionName: string, dayId: string) => void;
  onSessionClick: (sessionId: string) => void;
}

export default function DayColumn({ 
  day, 
  dayIndex, 
  onAddSession, 
  onDeleteDay,
  onDeleteSession,
  onSessionClick 
}: DayColumnProps) {
  // Sort sessions by startTime chronologically
  const sortedSessions = [...day.sessions].sort((a, b) => 
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <Paper 
      elevation={3}
      sx={{ 
        width: 350, 
        minWidth: 350, 
        display: "flex", 
        flexDirection: "column",
        height: "100%",
        borderRadius: 2,
        backgroundColor: "#fff"
      }}
    >
      {/* Day Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: "1px solid #eee", 
        backgroundColor: "#fafafa",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <Typography variant="subtitle1" fontWeight="bold" color="primary">
            Day {dayIndex + 1}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date(day.date).toLocaleDateString(undefined, { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric'
            })}
          </Typography>
        </div>
        
        <IconButton 
          size="small" 
          color="error"
          onClick={() => onDeleteDay(day.id, dayIndex, day.sessions.length)}
          sx={{ ml: 1 }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Sessions List */}
      <Box sx={{ 
        flexGrow: 1, 
        overflowY: "auto", 
        p: 2, 
        display: "flex", 
        flexDirection: "column", 
        gap: 2 
      }}>
        {sortedSessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onClick={() => onSessionClick(session.id)}
            onDelete={() => onDeleteSession(session.id, session.name, day.id)}
          />
        ))}

        {day.sessions.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
            No sessions planned.
          </Typography>
        )}
      </Box>

      {/* Add Session Button */}
      <Box sx={{ p: 2, borderTop: "1px solid #eee" }}>
        <Button 
          fullWidth 
          variant="outlined" 
          startIcon={<AddIcon />}
          onClick={() => onAddSession(day.id)}
        >
          New Session
        </Button>
      </Box>
    </Paper>
  );
}