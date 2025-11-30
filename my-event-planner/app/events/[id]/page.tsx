"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEventStore } from "@/store/eventStore";
import { useTrackingStore } from "@/store/trackingStore";
import { EventType } from "@/types/Event";
import {
  Typography, Button, Paper, IconButton, Box
} from "@mui/material";

import EventDetailHeader from "@/components/organisms/EventDetailHeader";
import DayColumn from "@/components/organisms/DayColumn";
import CreateSessionModal from "@/components/molecules/CreateSessionModal";
import ConfirmDeleteModal from "@/components/molecules/ConfirmDeleteModal";
import SessionGuestListModal from "@/components/molecules/SessionGuestListModal";

export default function EventDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  // Store Access
  const event = useEventStore(state => state.events.find(e => e.id === id));
  const addDay = useEventStore(state => state.addDay);
  const deleteDay = useEventStore(state => state.deleteDay);
  const addSession = useEventStore(state => state.addSession);
  const deleteSession = useEventStore(state => state.deleteSession);

  // Tracking Store
  const setSessionTracking = useTrackingStore(state => state.setSessionTracking);

  // Local State
  const [sessionModal, setSessionModal] = useState({ open: false, dayId: "" });
  const [sessionForm, setSessionForm] = useState({
    name: "",
    description: "",
    type: "Executive meeting" as EventType,
    time: "09:00",
    tracked: false,
  });

  // Delete Modals State
  const [deleteDayModal, setDeleteDayModal] = useState({ open: false, dayId: "", dayIndex: 0, sessionCount: 0 });
  const [deleteSessionModal, setDeleteSessionModal] = useState({
    open: false,
    sessionId: "",
    sessionName: "",
    dayId: ""
  });

  // Session Guest Management State
  const [guestModal, setGuestModal] = useState({
    open: false,
    sessionId: "",
    sessionName: "",
    dayId: ""
  });

  if (!event) return <div>Event not found</div>;

  /* --- 🧠 Logic: Add a new Day --- */
  const handleAddDay = () => {
    let nextDate = new Date();
    if (event.days.length > 0) {
      const lastDay = event.days[event.days.length - 1];
      const d = new Date(lastDay.date);
      d.setDate(d.getDate() + 1);
      nextDate = d;
    }

    const y = nextDate.getFullYear();
    const m = nextDate.getMonth();
    const dayNum = nextDate.getDate();
    const localMidnight = new Date(y, m, dayNum, 0, 0, 0, 0);
    addDay(event.id, localMidnight.toISOString());
  };

  /* --- 🧠 Logic: Delete Day --- */
  const handleDeleteDayClick = (dayId: string, dayIndex: number, sessionCount: number) => {
    setDeleteDayModal({ open: true, dayId, dayIndex, sessionCount });
  };

  const handleConfirmDeleteDay = () => {
    deleteDay(event.id, deleteDayModal.dayId);
    setDeleteDayModal({ open: false, dayId: "", dayIndex: 0, sessionCount: 0 });
  };

  /* --- 🧠 Logic: Delete Session --- */
  const handleDeleteSessionClick = (sessionId: string, sessionName: string, dayId: string) => {
    setDeleteSessionModal({ open: true, sessionId, sessionName, dayId });
  };

  const handleConfirmDeleteSession = () => {
    deleteSession(event.id, deleteSessionModal.dayId, deleteSessionModal.sessionId);
    setDeleteSessionModal({ open: false, sessionId: "", sessionName: "", dayId: "" });
  };

  /* --- 🧠 Logic: Manage Session Guests --- */
  const handleManageSessionGuests = (sessionId: string, sessionName: string) => {
    const day = event.days.find(d => d.sessions.some(s => s.id === sessionId));
    if (day) {
      setGuestModal({ open: true, sessionId, sessionName, dayId: day.id });
    }
  };

  const handleCreateSession = () => {
    if (!sessionModal.dayId) return;

    const dayObj = event.days.find(d => d.id === sessionModal.dayId);
    if (!dayObj) return;

    const dayDate = new Date(dayObj.date);
    const year = dayDate.getFullYear();
    const monthIndex = dayDate.getMonth();
    const dayNum = dayDate.getDate();

    const [hourStr, minuteStr] = sessionForm.time.split(":");
    const hour = Number(hourStr || "0");
    const minute = Number(minuteStr || "0");

    const localDate = new Date(year, monthIndex, dayNum, hour, minute, 0, 0);
    const isoStart = localDate.toISOString();

    // Create the session
    addSession(event.id, sessionModal.dayId, {
      name: sessionForm.name,
      description: sessionForm.description,
      sessionType: sessionForm.type,
      startTime: isoStart,
    });

    // Get the newly created session ID (it will be the last one added)
    const updatedEvent = useEventStore.getState().events.find(e => e.id === event.id);
    const updatedDay = updatedEvent?.days.find(d => d.id === sessionModal.dayId);
    const newSession = updatedDay?.sessions[updatedDay.sessions.length - 1];

    // Set tracking status if enabled
    if (newSession && sessionForm.tracked) {
      setSessionTracking(event.id, newSession.id, true);
    }

    setSessionModal({ open: false, dayId: "" });
    setSessionForm({ 
      name: "", 
      description: "", 
      type: "Executive meeting", 
      time: "09:00",
      tracked: false,
    });
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* --- HEADER --- */}
      <EventDetailHeader
        event={event}
        onBack={() => router.push("/")}
        onAddDay={handleAddDay}
      />

      {/* --- MAIN CONTENT: HORIZONTAL SCROLLING DAYS --- */}
      <Box sx={{ flexGrow: 1, overflowX: "auto", p: 3, backgroundColor: "#f5f5f5" }}>
        <div className="flex gap-6 h-full">

          {event.days.map((day, index) => (
            <DayColumn
              key={day.id}
              day={day}
              dayIndex={index}
              eventId={event.id}
              onAddSession={(dayId) => setSessionModal({ open: true, dayId })}
              onDeleteDay={handleDeleteDayClick}
              onDeleteSession={handleDeleteSessionClick}
              onSessionClick={(sessionId) => router.push(`/session/${sessionId}`)}
              onManageSessionGuests={handleManageSessionGuests}
            />
          ))}

          {event.days.length === 0 && (
            <div className="flex items-center justify-center w-full text-gray-400">
              <Typography>Click "Add Day" to begin planning.</Typography>
            </div>
          )}

        </div>
      </Box>

      {/* --- SESSION CREATION MODAL --- */}
      <CreateSessionModal
        open={sessionModal.open}
        sessionForm={sessionForm}
        onClose={() => setSessionModal({ ...sessionModal, open: false })}
        onChange={setSessionForm}
        onCreate={handleCreateSession}
      />

      {/* --- DELETE DAY CONFIRMATION MODAL --- */}
      <ConfirmDeleteModal
        open={deleteDayModal.open}
        title="Delete Day"
        message={`Are you sure you want to delete Day ${deleteDayModal.dayIndex + 1}? ${deleteDayModal.sessionCount > 0
          ? `This will also delete ${deleteDayModal.sessionCount} session${deleteDayModal.sessionCount > 1 ? 's' : ''}.`
          : ''
          }`}
        onClose={() => setDeleteDayModal({ open: false, dayId: "", dayIndex: 0, sessionCount: 0 })}
        onConfirm={handleConfirmDeleteDay}
      />

      {/* --- DELETE SESSION CONFIRMATION MODAL --- */}
      <ConfirmDeleteModal
        open={deleteSessionModal.open}
        title="Delete Session"
        message={`Are you sure you want to delete "${deleteSessionModal.sessionName}"?`}
        onClose={() => setDeleteSessionModal({ open: false, sessionId: "", sessionName: "", dayId: "" })}
        onConfirm={handleConfirmDeleteSession}
      />

      {/* --- SESSION GUEST MANAGEMENT MODAL --- */}
      <SessionGuestListModal
        open={guestModal.open}
        onClose={() => setGuestModal({ open: false, sessionId: "", sessionName: "", dayId: "" })}
        eventId={event.id}
        dayId={guestModal.dayId}
        sessionId={guestModal.sessionId}
        sessionName={guestModal.sessionName}
      />

    </Box>
  );
}