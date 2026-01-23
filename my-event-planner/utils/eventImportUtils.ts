import { v4 as uuidv4 } from "uuid";
import { Event, ensureTrackingFields, migrateEventSessionRules } from "@/types/Event";

/**
 * Result of parsing an event JSON file
 */
export interface ParseEventResult {
  success: boolean;
  event?: Event;
  error?: string;
}

/**
 * Validates and parses an event JSON string
 */
export function parseEventJSON(content: string): ParseEventResult {
  try {
    const parsedEvent = JSON.parse(content) as Event;

    // Basic validation
    if (!parsedEvent.name || !parsedEvent.days) {
      return {
        success: false,
        error: "Invalid event file format. Missing required fields (name or days)."
      };
    }

    // Apply migrations
    let migratedEvent = ensureTrackingFields(parsedEvent);
    migratedEvent = migrateEventSessionRules(migratedEvent);

    return {
      success: true,
      event: migratedEvent
    };
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    return {
      success: false,
      error: "Failed to parse JSON file. Please ensure it's a valid event export."
    };
  }
}

/**
 * Creates a mapping of old IDs to new UUIDs for all entities in an event
 */
function createIdMapping(event: Event): Record<string, string> {
  const idMapping: Record<string, string> = {};

  // Map guest IDs (both host and external)
  [...event.masterHostGuests, ...event.masterExternalGuests].forEach(guest => {
    idMapping[guest.id] = uuidv4();
  });

  // Map day, session, table, seat, and chunk IDs
  event.days.forEach(day => {
    idMapping[day.id] = uuidv4();
    
    day.sessions.forEach(session => {
      idMapping[session.id] = uuidv4();
      
      // Map table and seat IDs
      session.seatPlan.tables.forEach(table => {
        idMapping[table.id] = uuidv4();
        table.seats.forEach(seat => {
          idMapping[seat.id] = uuidv4();
        });
      });
      
      // Map chunk IDs
      Object.keys(session.seatPlan.chunks).forEach(chunkId => {
        idMapping[chunkId] = uuidv4();
      });
    });
  });

  return idMapping;
}

/**
 * Remaps an ID using the mapping, returns original if not found
 */
function remapId(idMapping: Record<string, string>, id: string): string {
  return idMapping[id] ?? id;
}

/**
 * Creates a new event with all IDs remapped to prevent conflicts
 */
export function createRemappedEvent(originalEvent: Event, newName: string): Event {
  const idMapping = createIdMapping(originalEvent);
  const remap = (id: string) => remapId(idMapping, id);
  const newEventId = uuidv4();

  return {
    ...originalEvent,
    id: newEventId,
    name: newName.trim(),
    createdAt: new Date().toISOString(),
    
    // Remap guest IDs
    masterHostGuests: originalEvent.masterHostGuests.map(guest => ({
      ...guest,
      id: remap(guest.id)
    })),
    masterExternalGuests: originalEvent.masterExternalGuests.map(guest => ({
      ...guest,
      id: remap(guest.id)
    })),
    
    // Remap tracked guest IDs
    trackedGuestIds: originalEvent.trackedGuestIds?.map(remap) ?? [],
    
    // Remap adjacency records
    adjacencyRecords: originalEvent.adjacencyRecords?.map(record => ({
      ...record,
      sessionId: remap(record.sessionId),
      trackedGuestId: remap(record.trackedGuestId),
      adjacentGuestIds: record.adjacentGuestIds.map(remap),
      adjacentGuestDetails: record.adjacentGuestDetails?.map(detail => ({
        ...detail,
        guestId: remap(detail.guestId)
      }))
    })) ?? [],
    
    // Remap planning order tracker
    planningOrderTracker: originalEvent.planningOrderTracker ? {
      ...originalEvent.planningOrderTracker,
      sessionOrderMap: Object.fromEntries(
        Object.entries(originalEvent.planningOrderTracker.sessionOrderMap).map(
          ([sessionId, order]) => [remap(sessionId), order]
        )
      )
    } : { sessionOrderMap: {}, nextOrder: 1 },
    
    // Remap days, sessions, tables, seats
    days: originalEvent.days.map(day => ({
      ...day,
      id: remap(day.id),
      sessions: day.sessions.map(session => ({
        ...session,
        id: remap(session.id),
        inheritedHostGuestIds: session.inheritedHostGuestIds.map(remap),
        inheritedExternalGuestIds: session.inheritedExternalGuestIds.map(remap),
        seatPlan: {
          ...session.seatPlan,
          activeGuestIds: session.seatPlan.activeGuestIds.map(remap),
          tables: session.seatPlan.tables.map(table => ({
            ...table,
            id: remap(table.id),
            seats: table.seats.map(seat => ({
              ...seat,
              id: remap(seat.id),
              assignedGuestId: seat.assignedGuestId ? remap(seat.assignedGuestId) : seat.assignedGuestId,
              adjacentSeats: seat.adjacentSeats?.map(remap)
            }))
          })),
          chunks: Object.fromEntries(
            Object.entries(session.seatPlan.chunks).map(([chunkId, chunk]) => [
              remap(chunkId),
              {
                ...chunk,
                id: remap(chunk.id),
                tables: chunk.tables.map(remap)
              }
            ])
          )
        },
        rulesConfig: session.rulesConfig ? {
          ...session.rulesConfig,
          proximityRules: {
            sitTogether: session.rulesConfig.proximityRules.sitTogether.map(rule => ({
              ...rule,
              id: uuidv4(),
              guest1Id: remap(rule.guest1Id),
              guest2Id: remap(rule.guest2Id)
            })),
            sitAway: session.rulesConfig.proximityRules.sitAway.map(rule => ({
              ...rule,
              id: uuidv4(),
              guest1Id: remap(rule.guest1Id),
              guest2Id: remap(rule.guest2Id)
            }))
          }
        } : session.rulesConfig,
        storedViolations: session.storedViolations?.map(violation => ({
          ...violation,
          guest1Id: remap(violation.guest1Id),
          guest2Id: remap(violation.guest2Id),
          tableId: remap(violation.tableId),
          seat1Id: violation.seat1Id ? remap(violation.seat1Id) : undefined,
          seat2Id: violation.seat2Id ? remap(violation.seat2Id) : undefined
        })) ?? []
      }))
    }))
  };
}

/**
 * Gets event import summary statistics
 */
export function getEventSummary(event: Event) {
  return {
    originalName: event.name,
    daysCount: event.days.length,
    sessionsCount: event.days.reduce((acc, day) => acc + day.sessions.length, 0),
    hostGuestsCount: event.masterHostGuests.length,
    externalGuestsCount: event.masterExternalGuests.length
  };
}

/**
 * Downloads event data as a JSON file
 */
export function downloadEventAsJSON(jsonData: string, eventName: string): void {
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  // Generate filename: event-name_YYYY-MM-DD.json
  const sanitizedName = eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `${sanitizedName}_${dateStr}.json`;
  
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}