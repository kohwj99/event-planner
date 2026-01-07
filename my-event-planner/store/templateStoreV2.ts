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

const BUILT_IN_TEMPLATES: TableTemplateV2[] = [
  {
    "name": "U-shaped Calls",
    "description": "Position of Honor (Left), Host (Right)\n",
    "sessionTypes": [
      "Bilateral Meeting"
    ],
    "isUserCreated": true,
    "color": "#7b1fa2",
    "config": {
      "type": "rectangle",
      "sides": {
        "top": {
          "seatCount": 2,
          "scalable": false,
          "enabled": true,
          "allocationPriority": 0
        },
        "right": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 2
        },
        "bottom": {
          "seatCount": 3,
          "scalable": true,
          "enabled": false,
          "allocationPriority": 1
        },
        "left": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 3
        }
      },
      "scalingConfig": {
        "allocationStrategy": "round-robin",
        "alternateOppositeSides": true,
        "insertionOrder": [
          {
            "side": "right",
            "edge": "end"
          },
          {
            "side": "left",
            "edge": "end"
          }
        ]
      },
      "orderingPattern": {
        "type": "manual",
        "direction": "clockwise",
        "startPosition": 0,
        "manualOrdering": [
          2,
          1,
          3,
          5,
          7,
          9,
          11,
          12,
          10,
          8,
          6,
          4
        ]
      },
      "modePattern": {
        "type": "manual",
        "defaultMode": "default",
        "manualModes": [
          "external-only",
          "host-only",
          "host-only",
          "host-only",
          "host-only",
          "host-only",
          "host-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only"
        ]
      }
    },
    "id": "9e5c7980-c406-4401-9822-e557dc8c8621",
    "isBuiltIn": false,
    "createdAt": "2026-01-05T01:46:04.492Z",
    "updatedAt": "2026-01-05T01:46:04.492Z"
  },
  {
    "name": "Boardroom Meetings",
    "description": "Host Officials (Top)\nGuest Officials (Bottom)\nArrangement - Center to outwards in protocol ordering",
    "sessionTypes": [
      "Executive meeting"
    ],
    "isUserCreated": true,
    "color": "#1976d2",
    "config": {
      "type": "rectangle",
      "sides": {
        "top": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 0
        },
        "right": {
          "seatCount": 1,
          "scalable": false,
          "enabled": false,
          "allocationPriority": 2
        },
        "bottom": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 1
        },
        "left": {
          "seatCount": 1,
          "scalable": false,
          "enabled": false,
          "allocationPriority": 3
        }
      },
      "scalingConfig": {
        "allocationStrategy": "round-robin",
        "alternateOppositeSides": true,
        "insertionOrder": [
          {
            "side": "top",
            "edge": "start"
          },
          {
            "side": "bottom",
            "edge": "end"
          },
          {
            "side": "top",
            "edge": "end"
          },
          {
            "side": "bottom",
            "edge": "start"
          }
        ]
      },
      "orderingPattern": {
        "type": "manual",
        "direction": "clockwise",
        "startPosition": 0,
        "manualOrdering": [
          7,
          3,
          1,
          5,
          9,
          8,
          4,
          2,
          6,
          10
        ]
      },
      "modePattern": {
        "type": "manual",
        "defaultMode": "default",
        "manualModes": [
          "host-only",
          "host-only",
          "host-only",
          "host-only",
          "host-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only"
        ]
      }
    },
    "id": "44f6f373-0eb6-43a8-a270-7e4226524e47",
    "isBuiltIn": false,
    "createdAt": "2026-01-05T01:50:07.150Z",
    "updatedAt": "2026-01-05T01:50:07.150Z"
  },
  {
    "name": "Long Table (with GOH)",
    "description": "Host (Center Top), GOH (Center Bottom).\nBoth sides alternate in seat modes",
    "sessionTypes": [
      "Meal",
      "Executive meeting"
    ],
    "isUserCreated": true,
    "color": "#388e3c",
    "config": {
      "type": "rectangle",
      "sides": {
        "top": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 0
        },
        "right": {
          "seatCount": 1,
          "scalable": false,
          "enabled": false,
          "allocationPriority": 2
        },
        "bottom": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 1
        },
        "left": {
          "seatCount": 1,
          "scalable": false,
          "enabled": false,
          "allocationPriority": 3
        }
      },
      "scalingConfig": {
        "allocationStrategy": "round-robin",
        "alternateOppositeSides": true,
        "insertionOrder": [
          {
            "side": "bottom",
            "edge": "end"
          },
          {
            "side": "top",
            "edge": "start"
          },
          {
            "side": "bottom",
            "edge": "start"
          },
          {
            "side": "top",
            "edge": "end"
          }
        ]
      },
      "orderingPattern": {
        "type": "manual",
        "direction": "clockwise",
        "startPosition": 0,
        "manualOrdering": [
          8,
          4,
          1,
          6,
          10,
          7,
          3,
          2,
          5,
          9
        ]
      },
      "modePattern": {
        "type": "manual",
        "defaultMode": "default",
        "manualModes": [
          "host-only",
          "external-only",
          "host-only",
          "external-only",
          "host-only",
          "external-only",
          "host-only",
          "external-only",
          "host-only",
          "external-only"
        ]
      }
    },
    "id": "a641953d-6d32-4265-8da3-cc32a80acfc5",
    "isBuiltIn": false,
    "createdAt": "2026-01-05T02:07:38.666Z",
    "updatedAt": "2026-01-05T02:09:45.588Z"
  },
  {
    "name": "Long Table (no GOH)",
    "description": "",
    "sessionTypes": [
      "Executive meeting",
      "Meal"
    ],
    "isUserCreated": true,
    "color": "#1976d2",
    "config": {
      "type": "rectangle",
      "sides": {
        "top": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 0
        },
        "right": {
          "seatCount": 1,
          "scalable": false,
          "enabled": false,
          "allocationPriority": 2
        },
        "bottom": {
          "seatCount": 5,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 1
        },
        "left": {
          "seatCount": 1,
          "scalable": false,
          "enabled": false,
          "allocationPriority": 3
        }
      },
      "scalingConfig": {
        "allocationStrategy": "round-robin",
        "alternateOppositeSides": true,
        "insertionOrder": [
          {
            "side": "top",
            "edge": "start"
          },
          {
            "side": "top",
            "edge": "end"
          },
          {
            "side": "bottom",
            "edge": "end"
          },
          {
            "side": "bottom",
            "edge": "start"
          }
        ]
      },
      "orderingPattern": {
        "type": "manual",
        "direction": "clockwise",
        "startPosition": 0,
        "manualOrdering": [
          7,
          3,
          1,
          4,
          8,
          9,
          5,
          2,
          6,
          10
        ]
      },
      "modePattern": {
        "type": "manual",
        "defaultMode": "default",
        "manualModes": [
          "external-only",
          "external-only",
          "host-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only",
          "external-only"
        ]
      }
    },
    "id": "cc0f94c1-bef1-4200-b28c-e72b3a8a75af",
    "isBuiltIn": false,
    "createdAt": "2026-01-05T02:11:28.311Z",
    "updatedAt": "2026-01-05T02:11:28.311Z"
  },
  {
    "name": "Farewell Dinner (VIP)",
    "description": "",
    "sessionTypes": [
      "Meal"
    ],
    "isUserCreated": true,
    "color": "#388e3c",
    "config": {
      "type": "circle",
      "baseSeatCount": 10,
      "orderingPattern": {
        "type": "manual",
        "direction": "clockwise",
        "startPosition": 0,
        "manualOrdering": [
          1,
          5,
          7,
          3,
          9,
          10,
          8,
          2,
          6,
          4
        ]
      },
      "modePattern": {
        "type": "manual",
        "defaultMode": "default",
        "manualModes": [
          "host-only",
          "external-only",
          "external-only",
          "host-only",
          "external-only",
          "external-only",
          "external-only",
          "host-only",
          "external-only",
          "external-only"
        ]
      }
    },
    "id": "5c84b622-b3a4-4580-a252-cace8ce88263",
    "isBuiltIn": false,
    "createdAt": "2026-01-05T02:14:41.116Z",
    "updatedAt": "2026-01-05T09:33:09.775Z"
  },
  {
    "name": "test1",
    "description": "qweqwe",
    "sessionTypes": [
      "Bilateral Meeting"
    ],
    "isUserCreated": true,
    "color": "#7b1fa2",
    "config": {
      "type": "rectangle",
      "sides": {
        "top": {
          "seatCount": 2,
          "scalable": false,
          "enabled": true,
          "allocationPriority": 0
        },
        "right": {
          "seatCount": 3,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 2
        },
        "bottom": {
          "seatCount": 3,
          "scalable": false,
          "enabled": false,
          "allocationPriority": 1
        },
        "left": {
          "seatCount": 3,
          "scalable": true,
          "enabled": true,
          "allocationPriority": 3
        }
      },
      "scalingConfig": {
        "allocationStrategy": "round-robin",
        "alternateOppositeSides": true,
        "insertionOrder": [
          {
            "side": "right",
            "edge": "end"
          },
          {
            "side": "left",
            "edge": "end"
          }
        ]
      },
      "orderingPattern": {
        "type": "manual",
        "direction": "clockwise",
        "startPosition": 0,
        "manualOrdering": [
          2,
          1,
          3,
          5,
          7,
          8,
          6,
          4
        ]
      },
      "modePattern": {
        "type": "manual",
        "defaultMode": "default",
        "manualModes": [
          "external-only",
          "host-only",
          "host-only",
          "host-only",
          "host-only",
          "external-only",
          "external-only",
          "external-only"
        ]
      }
    },
    "id": "f64f0fae-5404-48b8-8ff5-f65c82a3e72b",
    "isBuiltIn": false,
    "createdAt": "2026-01-05T02:29:33.602Z",
    "updatedAt": "2026-01-05T02:29:33.602Z"
  },
  {
    "name": "Meal Round Even ",
    "description": "",
    "sessionTypes": [
      "Meal"
    ],
    "isUserCreated": true,
    "color": "#388e3c",
    "config": {
      "type": "circle",
      "baseSeatCount": 12,
      "orderingPattern": {
        "type": "manual",
        "direction": "clockwise",
        "startPosition": 0,
        "manualOrdering": [
          1,
          8,
          3,
          10,
          5,
          12,
          6,
          11,
          4,
          9,
          2,
          7
        ]
      },
      "modePattern": {
        "type": "manual",
        "defaultMode": "default",
        "manualModes": [
          "host-only",
          "external-only",
          "host-only",
          "external-only",
          "host-only",
          "external-only",
          "host-only",
          "external-only",
          "host-only",
          "external-only",
          "host-only",
          "external-only"
        ]
      }
    },
    "id": "649676d0-084d-4ceb-9d2f-555bb4b72f66",
    "isBuiltIn": false,
    "createdAt": "2026-01-05T09:30:15.799Z",
    "updatedAt": "2026-01-05T09:30:15.799Z"
  }
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
        templates: [...BUILT_IN_TEMPLATES],
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
          set({ templates: [...BUILT_IN_TEMPLATES, ...userTemplates] });
        },
      }),
      {
        name: 'template-store-v2-clean',
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);

          if (state) {
            const existingIds = new Set(state.templates.map((t) => t.id));
            const missingBuiltIns = BUILT_IN_TEMPLATES.filter((t) => !existingIds.has(t.id));

            if (missingBuiltIns.length > 0) {
              state.templates = [...state.templates, ...missingBuiltIns];
            }

            state.templates = state.templates.map((t) => {
              if (t.isBuiltIn) {
                const builtIn = BUILT_IN_TEMPLATES.find((b) => b.id === t.id);
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

export { BUILT_IN_TEMPLATES };
export default useTemplateStoreV2;