// store/templateStore.ts
// ENHANCED: Zustand store for managing table templates with intelligent pattern system

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { 
  TableTemplate, 
  CreateTemplateInput, 
  UpdateTemplateInput,
  SESSION_TYPE_COLORS,
  EnhancedSeatModePattern,
} from '@/types/Template';
import { EventType } from '@/types/Event';
import { SeatMode } from '@/types/Seat';

// ============================================================================
// HELPER: Generate repeating pattern modes
// ============================================================================

function generateRepeatingModes(sequence: SeatMode[], count: number): SeatMode[] {
  const modes: SeatMode[] = [];
  for (let i = 0; i < count; i++) {
    modes.push(sequence[i % sequence.length]);
  }
  return modes;
}

function generateAlternatingModes(mode1: SeatMode, mode2: SeatMode, count: number): SeatMode[] {
  const modes: SeatMode[] = [];
  for (let i = 0; i < count; i++) {
    modes.push(i % 2 === 0 ? mode1 : mode2);
  }
  return modes;
}

function generateSpecificModes(
  specificPositions: Record<number, SeatMode>,
  defaultMode: SeatMode,
  count: number
): SeatMode[] {
  const modes: SeatMode[] = Array(count).fill(defaultMode);
  Object.entries(specificPositions).forEach(([pos, mode]) => {
    const index = parseInt(pos, 10);
    if (index >= 0 && index < count) {
      modes[index] = mode;
    }
  });
  return modes;
}

// ============================================================================
// BUILT-IN TEMPLATES (with enhanced patterns)
// ============================================================================

const BUILT_IN_TEMPLATES: TableTemplate[] = [
  // ==================== EXECUTIVE MEETING TEMPLATES ====================
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
      strategy: 'custom',
      baseModes: generateSpecificModes({ 0: 'host-only', 1: 'host-only' }, 'default', 10),
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
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
      strategy: 'custom',
      baseModes: generateSpecificModes({ 4: 'host-only', 9: 'host-only' }, 'default', 10),
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 6,
    maxSeats: 24,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'exec-alternating',
    name: 'Executive Alternating',
    description: 'Round table with alternating host and external seats for balanced discussion.',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Executive meeting'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 8,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'alternating',
    startPosition: 0,
    seatModePattern: {
      strategy: 'repeating-sequence',
      baseModes: generateAlternatingModes('host-only', 'external-only', 8),
      sequence: ['host-only', 'external-only'],
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 4,
    maxSeats: 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== BILATERAL MEETING TEMPLATES ====================
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
      strategy: 'repeating-sequence',
      baseModes: generateAlternatingModes('host-only', 'external-only', 6),
      sequence: ['host-only', 'external-only'],
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 4,
    maxSeats: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bilateral-facing',
    name: 'Face-to-Face',
    description: 'Rectangle table with host side facing external side. Ideal for negotiations.',
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
    orderingPattern: 'opposite',
    startPosition: 0,
    seatModePattern: {
      strategy: 'ratio-contiguous',
      baseModes: ['host-only', 'host-only', 'host-only', 'external-only', 'external-only', 'external-only'],
      ratios: { 'host-only': 0.5, 'external-only': 0.5, 'default': 0 },
      blockOrder: ['host-only', 'external-only'],
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 4,
    maxSeats: 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bilateral-pairs',
    name: 'Paired Bilateral',
    description: 'Round table with pairs of host/external seats. HH, EE repeating pattern.',
    sessionTypes: ['Bilateral Meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Bilateral Meeting'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 8,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'sequential',
    startPosition: 0,
    seatModePattern: {
      strategy: 'repeating-sequence',
      baseModes: generateRepeatingModes(['host-only', 'host-only', 'external-only', 'external-only'], 8),
      sequence: ['host-only', 'host-only', 'external-only', 'external-only'],
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 4,
    maxSeats: 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== MEAL TEMPLATES ====================
  {
    id: 'meal-banquet-round',
    name: 'Banquet Round',
    description: 'Classic banquet round table. All default seats for flexible guest placement.',
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
      strategy: 'uniform',
      baseModes: Array(10).fill('default'),
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 6,
    maxSeats: 14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'meal-long-table',
    name: 'Long Dining Table',
    description: 'Long rectangle table for formal dining. Host at head position.',
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
    startPosition: 5,
    seatModePattern: {
      strategy: 'custom',
      baseModes: generateSpecificModes({ 5: 'host-only', 11: 'host-only' }, 'default', 12),
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 8,
    maxSeats: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'meal-mixed-round',
    name: 'Mixed Dining Round',
    description: 'Round table with mixed seating pattern: HH, EE, DD repeating for diverse interaction.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS['Meal'],
    baseConfig: {
      type: 'round',
      baseSeatCount: 12,
    },
    orderingDirection: 'counter-clockwise',
    orderingPattern: 'alternating',
    startPosition: 0,
    seatModePattern: {
      strategy: 'repeating-sequence',
      baseModes: generateRepeatingModes(['host-only', 'host-only', 'external-only', 'external-only', 'default', 'default'], 12),
      sequence: ['host-only', 'host-only', 'external-only', 'external-only', 'default', 'default'],
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 6,
    maxSeats: 18,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ==================== PHOTOTAKING TEMPLATES ====================
  {
    id: 'photo-semicircle',
    name: 'Photo Arc',
    description: 'Round arrangement for group photos. VIPs (host+external) in center positions.',
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
      strategy: 'custom',
      baseModes: generateSpecificModes({ 0: 'host-only', 1: 'external-only' }, 'default', 8),
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
    minSeats: 4,
    maxSeats: 16,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'photo-line',
    name: 'Photo Line',
    description: 'Single row arrangement. VIPs in the center positions.',
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
    startPosition: 4,
    seatModePattern: {
      strategy: 'custom',
      baseModes: generateSpecificModes({ 3: 'host-only', 4: 'external-only' }, 'default', 8),
      defaultMode: 'default',
    } as EnhancedSeatModePattern,
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
        name: 'template-store-v2', // New version to avoid conflicts with old data
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
            
            // Update existing built-in templates with new pattern format
            state.templates = state.templates.map(t => {
              if (t.isBuiltIn) {
                const builtIn = BUILT_IN_TEMPLATES.find(b => b.id === t.id);
                if (builtIn) {
                  return { ...t, seatModePattern: builtIn.seatModePattern };
                }
              }
              return t;
            });
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