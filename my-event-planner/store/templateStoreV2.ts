// store/templateStoreV2.ts
// V2 Template Store - COMPLETELY INDEPENDENT from V1
// Zustand store for managing table templates

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  TableTemplateV2,
  CreateTemplateInputV2,
  UpdateTemplateInputV2,
  CircleTableConfigV2,
  RectangleTableConfigV2,
  EventType,
  SeatMode,
  SESSION_TYPE_COLORS_V2,
  getTotalSeatCountV2,
} from '@/types/TemplateV2';

// ============================================================================
// BUILT-IN TEMPLATES
// ============================================================================

const now = new Date().toISOString();

const BUILT_IN_TEMPLATES_V2: TableTemplateV2[] = [
  // ==================== EXECUTIVE MEETING ====================
  {
    id: 'v2-exec-round-10',
    name: 'Executive Round Table',
    description: 'Round table with VIP-first seating. Host seats at positions 1-2.',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Executive meeting'],
    config: {
      type: 'circle',
      baseSeatCount: 10,
      orderingPattern: {
        type: 'alternating',
        direction: 'counter-clockwise',
        startPosition: 0,
      },
      modePattern: {
        type: 'manual',
        defaultMode: 'default',
        manualModes: ['host-only', 'host-only', 'default', 'default', 'default', 
                      'default', 'default', 'default', 'default', 'default'],
      },
    } as CircleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'v2-exec-boardroom',
    name: 'Executive Boardroom',
    description: 'Rectangle table with host heads at each end. Scales on top/bottom.',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Executive meeting'],
    config: {
      type: 'rectangle',
      sides: {
        top: { seatCount: 4, scalable: true, enabled: true, allocationPriority: 0 },
        right: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 2 },
        bottom: { seatCount: 4, scalable: true, enabled: true, allocationPriority: 1 },
        left: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 3 },
      },
      scalingConfig: { allocationStrategy: 'round-robin', alternateOppositeSides: true },
      orderingPattern: { type: 'sequential', direction: 'clockwise', startPosition: 0 },
      modePattern: { type: 'uniform', defaultMode: 'default' },
    } as RectangleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'v2-exec-alternating',
    name: 'Executive Alternating',
    description: 'Round table with alternating host and external seats.',
    sessionTypes: ['Executive meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Executive meeting'],
    config: {
      type: 'circle',
      baseSeatCount: 8,
      orderingPattern: { type: 'alternating', direction: 'counter-clockwise', startPosition: 0 },
      modePattern: { type: 'alternating', defaultMode: 'default', alternatingModes: ['host-only', 'external-only'] },
    } as CircleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },

  // ==================== BILATERAL MEETING ====================
  {
    id: 'v2-bilateral-round',
    name: 'Bilateral Discussion',
    description: 'Small round table for bilateral discussions.',
    sessionTypes: ['Bilateral Meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Bilateral Meeting'],
    config: {
      type: 'circle',
      baseSeatCount: 6,
      orderingPattern: { type: 'sequential', direction: 'counter-clockwise', startPosition: 0 },
      modePattern: { type: 'alternating', defaultMode: 'default', alternatingModes: ['host-only', 'external-only'] },
    } as CircleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'v2-bilateral-facing',
    name: 'Face-to-Face Bilateral',
    description: 'Host side facing external side.',
    sessionTypes: ['Bilateral Meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Bilateral Meeting'],
    config: {
      type: 'rectangle',
      sides: {
        top: { seatCount: 4, scalable: true, enabled: true, allocationPriority: 0 },
        right: { seatCount: 0, scalable: false, enabled: false, allocationPriority: 2 },
        bottom: { seatCount: 4, scalable: true, enabled: true, allocationPriority: 1 },
        left: { seatCount: 0, scalable: false, enabled: false, allocationPriority: 3 },
      },
      scalingConfig: { allocationStrategy: 'round-robin', alternateOppositeSides: true },
      orderingPattern: { type: 'opposite', direction: 'clockwise', startPosition: 0 },
      modePattern: { type: 'uniform', defaultMode: 'default' },
    } as RectangleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'v2-bilateral-pairs',
    name: 'Paired Bilateral',
    description: 'Round table with HH, EE repeating pattern.',
    sessionTypes: ['Bilateral Meeting'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Bilateral Meeting'],
    config: {
      type: 'circle',
      baseSeatCount: 8,
      orderingPattern: { type: 'sequential', direction: 'counter-clockwise', startPosition: 0 },
      modePattern: { type: 'repeating', defaultMode: 'default', repeatingSequence: ['host-only', 'host-only', 'external-only', 'external-only'] },
    } as CircleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },

  // ==================== MEAL ====================
  {
    id: 'v2-meal-banquet',
    name: 'Banquet Round',
    description: 'Classic banquet round table. All default seats.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Meal'],
    config: {
      type: 'circle',
      baseSeatCount: 10,
      orderingPattern: { type: 'alternating', direction: 'counter-clockwise', startPosition: 0 },
      modePattern: { type: 'uniform', defaultMode: 'default' },
    } as CircleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'v2-meal-vip',
    name: 'VIP Dining',
    description: 'Round table with VIPs at seats 1-2.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Meal'],
    config: {
      type: 'circle',
      baseSeatCount: 8,
      orderingPattern: { type: 'alternating', direction: 'counter-clockwise', startPosition: 0 },
      modePattern: { type: 'manual', defaultMode: 'default', manualModes: ['host-only', 'external-only', 'default', 'default', 'default', 'default', 'default', 'default'] },
    } as CircleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'v2-meal-long',
    name: 'Long Dining Table',
    description: 'Rectangular table for formal dinners.',
    sessionTypes: ['Meal'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Meal'],
    config: {
      type: 'rectangle',
      sides: {
        top: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 0 },
        right: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 2 },
        bottom: { seatCount: 5, scalable: true, enabled: true, allocationPriority: 1 },
        left: { seatCount: 1, scalable: false, enabled: true, allocationPriority: 3 },
      },
      scalingConfig: { allocationStrategy: 'round-robin', alternateOppositeSides: true },
      orderingPattern: { type: 'alternating', direction: 'clockwise', startPosition: 0 },
      modePattern: { type: 'alternating', defaultMode: 'default', alternatingModes: ['host-only', 'external-only'] },
    } as RectangleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },

  // ==================== PHOTOTAKING ====================
  {
    id: 'v2-photo-arc',
    name: 'Photo Arc',
    description: 'Arc arrangement for photos. VIPs in center.',
    sessionTypes: ['Phototaking'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Phototaking'],
    config: {
      type: 'circle',
      baseSeatCount: 8,
      orderingPattern: { type: 'alternating', direction: 'counter-clockwise', startPosition: 0 },
      modePattern: { type: 'manual', defaultMode: 'default', manualModes: ['host-only', 'external-only', 'default', 'default', 'default', 'default', 'default', 'default'] },
    } as CircleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'v2-photo-line',
    name: 'Photo Line',
    description: 'Single row. VIPs in center, scales outward.',
    sessionTypes: ['Phototaking'],
    isBuiltIn: true,
    isUserCreated: false,
    color: SESSION_TYPE_COLORS_V2['Phototaking'],
    config: {
      type: 'rectangle',
      sides: {
        top: { seatCount: 8, scalable: true, enabled: true, allocationPriority: 0 },
        right: { seatCount: 0, scalable: false, enabled: false, allocationPriority: 2 },
        bottom: { seatCount: 0, scalable: false, enabled: false, allocationPriority: 1 },
        left: { seatCount: 0, scalable: false, enabled: false, allocationPriority: 3 },
      },
      scalingConfig: { allocationStrategy: 'priority', alternateOppositeSides: false },
      orderingPattern: { type: 'alternating', direction: 'counter-clockwise', startPosition: 3 },
      modePattern: { type: 'manual', defaultMode: 'default', manualModes: ['default', 'default', 'default', 'host-only', 'external-only', 'default', 'default', 'default'] },
    } as RectangleTableConfigV2,
    createdAt: now,
    updatedAt: now,
  },
];

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface TemplateStoreStateV2 {
  templates: TableTemplateV2[];
  _hasHydrated: boolean;

  setHasHydrated: (state: boolean) => void;

  getTemplateById: (id: string) => TableTemplateV2 | undefined;
  getTemplatesBySessionType: (sessionType: EventType) => TableTemplateV2[];
  getAllTemplates: () => TableTemplateV2[];
  getBuiltInTemplates: () => TableTemplateV2[];
  getUserTemplates: () => TableTemplateV2[];
  getTemplatesByShape: (shape: 'circle' | 'rectangle') => TableTemplateV2[];
  searchTemplates: (query: string) => TableTemplateV2[];

  createTemplate: (input: CreateTemplateInputV2) => TableTemplateV2;
  updateTemplate: (id: string, input: UpdateTemplateInputV2) => boolean;
  deleteTemplate: (id: string) => boolean;
  duplicateTemplate: (id: string, newName?: string) => TableTemplateV2 | null;

  resetToDefaults: () => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useTemplateStoreV2 = create<TemplateStoreStateV2>()(
  devtools(
    persist(
      (set, get) => ({
        templates: [...BUILT_IN_TEMPLATES_V2],
        _hasHydrated: false,

        setHasHydrated: (state) => set({ _hasHydrated: state }),

        getTemplateById: (id) => get().templates.find((t) => t.id === id),

        getTemplatesBySessionType: (sessionType) => 
          get().templates.filter((t) => t.sessionTypes.includes(sessionType)),

        getAllTemplates: () => get().templates,

        getBuiltInTemplates: () => get().templates.filter((t) => t.isBuiltIn),

        getUserTemplates: () => get().templates.filter((t) => t.isUserCreated),

        getTemplatesByShape: (shape) => 
          get().templates.filter((t) => t.config.type === shape),

        searchTemplates: (query) => {
          const lowerQuery = query.toLowerCase();
          return get().templates.filter((t) =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description.toLowerCase().includes(lowerQuery)
          );
        },

        createTemplate: (input) => {
          const now = new Date().toISOString();
          const newTemplate: TableTemplateV2 = {
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

          if (template.isBuiltIn) {
            console.warn('Cannot edit built-in templates. Duplicate instead.');
            return false;
          }

          set((state) => ({
            templates: state.templates.map((t) =>
              t.id === id ? { ...t, ...input, updatedAt: new Date().toISOString() } : t
            ),
          }));

          return true;
        },

        deleteTemplate: (id) => {
          const template = get().getTemplateById(id);
          if (!template) return false;

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

          const duplicateInput: CreateTemplateInputV2 = {
            name: newName || `${template.name} (Copy)`,
            description: template.description,
            sessionTypes: [...template.sessionTypes],
            isUserCreated: true,
            color: template.color,
            config: JSON.parse(JSON.stringify(template.config)),
          };

          return get().createTemplate(duplicateInput);
        },

        resetToDefaults: () => {
          const userTemplates = get().getUserTemplates();
          set({ templates: [...BUILT_IN_TEMPLATES_V2, ...userTemplates] });
        },
      }),
      {
        name: 'template-store-v2-clean',
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);

          if (state) {
            const existingIds = new Set(state.templates.map((t) => t.id));
            const missingBuiltIns = BUILT_IN_TEMPLATES_V2.filter((t) => !existingIds.has(t.id));
            
            if (missingBuiltIns.length > 0) {
              state.templates = [...state.templates, ...missingBuiltIns];
            }

            state.templates = state.templates.map((t) => {
              if (t.isBuiltIn) {
                const builtIn = BUILT_IN_TEMPLATES_V2.find((b) => b.id === t.id);
                if (builtIn) return { ...builtIn };
              }
              return t;
            });
          }
        },
      }
    ),
    { name: 'TemplateStoreV2' }
  )
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

export function useTemplatesForSessionV2(sessionType: EventType | null) {
  const templates = useTemplateStoreV2((s) => s.templates);
  if (!sessionType) return templates;
  return templates.filter((t) => t.sessionTypes.includes(sessionType));
}

export function useTemplateV2(id: string | null) {
  const templates = useTemplateStoreV2((s) => s.templates);
  return id ? templates.find((t) => t.id === id) : undefined;
}

export function useTemplatesByShapeV2(shape: 'circle' | 'rectangle') {
  const templates = useTemplateStoreV2((s) => s.templates);
  return templates.filter((t) => t.config.type === shape);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { BUILT_IN_TEMPLATES_V2 };
export default useTemplateStoreV2;