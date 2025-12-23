// store/templateStore.ts
// Zustand store for managing table templates

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { 
  TableTemplate, 
  CreateTemplateInput, 
  UpdateTemplateInput,
  SESSION_TYPE_COLORS 
} from '@/types/Template';
import { EventType } from '@/types/Event';

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

const BUILT_IN_TEMPLATES: TableTemplate[] = [
  // EXECUTIVE MEETING TEMPLATES
  {
    id: 'exec-round-10',
    name: 'Executive Round Table',
    description: 'Round table with VIP-first seating for executive meetings. Host seats prioritized at positions 1-2.',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Executive meeting'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 10,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'alternating',
    startPosition: 0,
    seatModePattern: {
      type: 'specific',
      specificModes: { 0: 'host-only', 1: 'host-only' },
      defaultMode: 'default',
    },
    minSeats: 6,
    maxSeats: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'exec-rect-boardroom',
    name: 'Executive Boardroom',
    description: 'Rectangle table with host heads at each end. Grows horizontally for more guests.',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Executive meeting'],
    baseConfig: {
      type: 'rectangle',
      baseSeats: { top: 4, bottom: 4, left: 1, right: 1 },
      growthSides: { top: true, bottom: true, left: false, right: false },
    },
    orderingDirection: 'clockwise',
    orderingPattern: 'sequential',
    startPosition: 0,
    seatModePattern: {
      type: 'specific',
      specificModes: { 4: 'host-only', 9: 'host-only' }, // Left and right ends
      defaultMode: 'default',
    },
    minSeats: 6,
    maxSeats: 24,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'exec-opposite-round',
    name: 'Executive Face-Off',
    description: 'Round table where VIP pairs face each other. Seat 1 faces Seat 2, Seat 3 faces Seat 4, etc.',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Executive meeting'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 8,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'opposite',
    startPosition: 0,
    seatModePattern: {
      type: 'specific',
      specificModes: { 0: 'host-only', 4: 'external-only' }, // VIP host faces VIP external
      defaultMode: 'default',
    },
    minSeats: 4,
    maxSeats: 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // BILATERAL MEETING TEMPLATES
  {
    id: 'bilateral-small',
    name: 'Bilateral Discussion',
    description: 'Small round table for focused bilateral discussions. Alternating host/external seating.',
    sessionTypes: ['Bilateral Meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Bilateral Meeting'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 6,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'sequential',
    startPosition: 0,
    seatModePattern: {
      type: 'alternating',
      alternatingModes: ['host-only', 'external-only'],
      defaultMode: 'default',
    },
    minSeats: 4,
    maxSeats: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bilateral-facing',
    name: 'Face-to-Face',
    description: 'Rectangle table with host and external guests facing each other. Uses opposite ordering.',
    sessionTypes: ['Bilateral Meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Bilateral Meeting'],
    baseConfig: {
      type: 'rectangle',
      baseSeats: { top: 3, bottom: 3, left: 0, right: 0 },
      growthSides: { top: true, bottom: true, left: false, right: false },
    },
    orderingDirection: 'clockwise',
    orderingPattern: 'opposite', // Pairs face each other
    startPosition: 0,
    seatModePattern: {
      type: 'specific',
      specificModes: { 0: 'host-only', 1: 'host-only', 2: 'host-only' }, // Top row = host
      defaultMode: 'external-only', // Bottom row = external
    },
    minSeats: 4,
    maxSeats: 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bilateral-opposite-round',
    name: 'Paired Bilateral',
    description: 'Round table optimized for 1-on-1 discussions. Each host faces their external counterpart.',
    sessionTypes: ['Bilateral Meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Bilateral Meeting'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 6,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'opposite',
    startPosition: 0,
    seatModePattern: {
      type: 'alternating',
      alternatingModes: ['host-only', 'external-only'], // Odd seats host, even seats external
      defaultMode: 'default',
    },
    minSeats: 4,
    maxSeats: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // MEAL TEMPLATES
  {
    id: 'meal-banquet-round',
    name: 'Banquet Round',
    description: 'Classic banquet round table with VIP-priority seating. Alternating pattern for balanced mixing.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Meal'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 10,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'alternating',
    startPosition: 0,
    seatModePattern: {
      type: 'repeating',
      pattern: ['default'],
      defaultMode: 'default',
    },
    minSeats: 6,
    maxSeats: 14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'meal-long-table',
    name: 'Long Dining Table',
    description: 'Long rectangle table for formal dining. Host at head, grows along the sides.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Meal'],
    baseConfig: {
      type: 'rectangle',
      baseSeats: { top: 5, bottom: 5, left: 1, right: 1 },
      growthSides: { top: true, bottom: true, left: false, right: false },
    },
    orderingDirection: 'clockwise',
    orderingPattern: 'alternating',
    startPosition: 5, // Start at left head
    seatModePattern: {
      type: 'specific',
      specificModes: { 5: 'host-only' }, // Left head = VIP host
      defaultMode: 'default',
    },
    minSeats: 8,
    maxSeats: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'meal-intimate',
    name: 'Intimate Dinner',
    description: 'Small round table for intimate dining experiences. Perfect for VIP dinners.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Meal'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 6,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'alternating',
    startPosition: 0,
    seatModePattern: {
      type: 'specific',
      specificModes: { 0: 'host-only' },
      defaultMode: 'default',
    },
    minSeats: 4,
    maxSeats: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'meal-opposite-dining',
    name: 'Formal Dining Pairs',
    description: 'Rectangle table where dining partners face each other across the table.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Meal'],
    baseConfig: {
      type: 'rectangle',
      baseSeats: { top: 4, bottom: 4, left: 0, right: 0 },
      growthSides: { top: true, bottom: true, left: false, right: false },
    },
    orderingDirection: 'clockwise',
    orderingPattern: 'opposite',
    startPosition: 0,
    seatModePattern: {
      type: 'repeating',
      pattern: ['default'],
      defaultMode: 'default',
    },
    minSeats: 4,
    maxSeats: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // PHOTOTAKING TEMPLATES
  {
    id: 'photo-semicircle',
    name: 'Photo Arc',
    description: 'Round arrangement for group photos. VIPs in center positions.',
    sessionTypes: ['Phototaking'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Phototaking'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 8,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'alternating',
    startPosition: 0,
    seatModePattern: {
      type: 'specific',
      specificModes: { 0: 'host-only', 1: 'external-only' }, // VIPs at center
      defaultMode: 'default',
    },
    minSeats: 4,
    maxSeats: 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'photo-line',
    name: 'Photo Line',
    description: 'Single row arrangement for photos. VIPs in the center.',
    sessionTypes: ['Phototaking'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Phototaking'],
    baseConfig: {
      type: 'rectangle',
      baseSeats: { top: 8, bottom: 0, left: 0, right: 0 },
      growthSides: { top: true, bottom: false, left: false, right: false },
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'alternating',
    startPosition: 4, // Center position
    seatModePattern: {
      type: 'specific',
      specificModes: { 3: 'host-only', 4: 'external-only' },
      defaultMode: 'default',
    },
    minSeats: 4,
    maxSeats: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface TemplateStoreState {
  templates: TableTemplate[];
  _hasHydrated: boolean;

  // Hydration
  setHasHydrated: (state: boolean) => void;

  // CRUD Operations
  getTemplateById: (id: string) => TableTemplate | undefined;
  getTemplatesBySessionType: (sessionType: EventType) => TableTemplate[];
  getAllTemplates: () => TableTemplate[];
  getBuiltInTemplates: () => TableTemplate[];
  getUserTemplates: () => TableTemplate[];

  createTemplate: (input: CreateTemplateInput) => TableTemplate;
  updateTemplate: (id: string, input: UpdateTemplateInput) => boolean;
  deleteTemplate: (id: string) => boolean;
  duplicateTemplate: (id: string, newName?: string) => TableTemplate | null;

  // Reset to defaults
  resetToDefaults: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useTemplateStore = create<TemplateStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        templates: [...BUILT_IN_TEMPLATES],
        _hasHydrated: false,

        setHasHydrated: (state) => set({ _hasHydrated: state }),

        getTemplateById: (id) => {
          return get().templates.find((t) => t.id === id);
        },

        getTemplatesBySessionType: (sessionType) => {
          return get().templates.filter((t) => 
            t.sessionTypes.includes(sessionType)
          );
        },

        getAllTemplates: () => get().templates,

        getBuiltInTemplates: () => {
          return get().templates.filter((t) => t.isBuiltIn);
        },

        getUserTemplates: () => {
          return get().templates.filter((t) => t.isUserCreated);
        },

        createTemplate: (input) => {
          const now = new Date().toISOString();
          const newTemplate: TableTemplate = {
            ...input,
            id: uuidv4(),
            isBuiltIn: false,
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            templates: [...state.templates, newTemplate],
          }));

          return newTemplate;
        },

        updateTemplate: (id, input) => {
          const template = get().getTemplateById(id);
          if (!template) return false;

          // Don't allow editing built-in templates (but can duplicate them)
          if (template.isBuiltIn) {
            console.warn('Cannot edit built-in templates. Duplicate instead.');
            return false;
          }

          set((state) => ({
            templates: state.templates.map((t) =>
              t.id === id
                ? { ...t, ...input, updatedAt: new Date().toISOString() }
                : t
            ),
          }));

          return true;
        },

        deleteTemplate: (id) => {
          const template = get().getTemplateById(id);
          if (!template) return false;

          // Don't allow deleting built-in templates
          if (template.isBuiltIn) {
            console.warn('Cannot delete built-in templates.');
            return false;
          }

          set((state) => ({
            templates: state.templates.filter((t) => t.id !== id),
          }));

          return true;
        },

        duplicateTemplate: (id, newName) => {
          const template = get().getTemplateById(id);
          if (!template) return null;

          const duplicateInput: CreateTemplateInput = {
            name: newName || `${template.name} (Copy)`,
            description: template.description,
            sessionTypes: [...template.sessionTypes],
            isUserCreated: true,
            color: template.color,
            baseConfig: JSON.parse(JSON.stringify(template.baseConfig)),
            orderingDirection: template.orderingDirection,
            orderingPattern: template.orderingPattern,
            startPosition: template.startPosition,
            seatModePattern: JSON.parse(JSON.stringify(template.seatModePattern)),
            minSeats: template.minSeats,
            maxSeats: template.maxSeats,
          };

          return get().createTemplate(duplicateInput);
        },

        resetToDefaults: () => {
          // Keep user templates, reset built-in ones
          const userTemplates = get().getUserTemplates();
          set({
            templates: [...BUILT_IN_TEMPLATES, ...userTemplates],
          });
        },
      }),
      {
        name: 'template-store',
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
          
          // Ensure built-in templates exist (in case they were added in an update)
          if (state) {
            const existingIds = new Set(state.templates.map(t => t.id));
            const missingBuiltIns = BUILT_IN_TEMPLATES.filter(
              t => !existingIds.has(t.id)
            );
            if (missingBuiltIns.length > 0) {
              state.templates = [...state.templates, ...missingBuiltIns];
            }
          }
        },
      }
    ),
    { name: 'TemplateStore' }
  )
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Get templates filtered by session type (for use in components)
 */
export function useTemplatesForSession(sessionType: EventType | null) {
  const templates = useTemplateStore((s) => s.templates);
  
  if (!sessionType) {
    return templates;
  }
  
  return templates.filter((t) => t.sessionTypes.includes(sessionType));
}

/**
 * Get a single template by ID
 */
export function useTemplate(id: string | null) {
  const templates = useTemplateStore((s) => s.templates);
  return id ? templates.find((t) => t.id === id) : undefined;
}