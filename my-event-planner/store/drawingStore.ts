// store/drawingStore.ts
// Zustand store for managing drawing layer state
// Provides CRUD operations for shapes and selection management

import { create } from 'zustand';
import {
  DrawingShape,
  DrawingShapeType,
  DrawingLayerState,
  createDefaultShape,
  validateShape,
} from '@/types/DrawingShape';
import { getDefaultDrawingColor } from '@/utils/drawingColorConfig';

// ============================================================================
// STORE STATE TYPE
// ============================================================================

interface DrawingStoreState {
  // Shape data
  shapes: DrawingShape[];
  nextZIndex: number;
  
  // Selection state
  selectedShapeId: string | null;
  
  // Current drawing tool
  currentShapeType: DrawingShapeType;
  currentColor: string;
  
  // CRUD Operations
  addShape: (shape: DrawingShape) => void;
  updateShape: (id: string, updates: Partial<DrawingShape>) => void;
  deleteShape: (id: string) => void;
  duplicateShape: (id: string) => DrawingShape | null;
  
  // Selection
  selectShape: (id: string | null) => void;
  getSelectedShape: () => DrawingShape | null;
  
  // Z-Index management
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  
  // Tool state
  setCurrentShapeType: (type: DrawingShapeType) => void;
  setCurrentColor: (color: string) => void;
  
  // Bulk operations
  clearAllShapes: () => void;
  setShapes: (shapes: DrawingShape[]) => void;
  
  // Session persistence
  getDrawingLayerState: () => DrawingLayerState;
  loadDrawingLayerState: (state: DrawingLayerState | null) => void;
  resetDrawingStore: () => void;
}

// ============================================================================
// CREATE STORE
// ============================================================================

export const useDrawingStore = create<DrawingStoreState>((set, get) => ({
  // Initial state
  shapes: [],
  nextZIndex: 1,
  selectedShapeId: null,
  currentShapeType: 'rectangle',
  currentColor: getDefaultDrawingColor(false).value,
  
  // ============== CRUD OPERATIONS ==============
  
  addShape: (shape) => {
    // Validate and ensure all properties exist
    const validatedShape = validateShape({
      ...shape,
      zIndex: get().nextZIndex,
    });
    
    console.log('[drawingStore] Adding shape:', validatedShape);
    
    set((state) => ({
      shapes: [...state.shapes, validatedShape],
      nextZIndex: state.nextZIndex + 1,
      selectedShapeId: validatedShape.id,
    }));
  },
  
  updateShape: (id, updates) => {
    set((state) => ({
      shapes: state.shapes.map((s) => {
        if (s.id === id) {
          // Merge updates but ensure valid values
          const updated = { ...s, ...updates };
          return updated;
        }
        return s;
      }),
    }));
  },
  
  deleteShape: (id) => {
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
    }));
  },
  
  duplicateShape: (id) => {
    const state = get();
    const original = state.shapes.find((s) => s.id === id);
    if (!original) return null;
    
    const newShape = validateShape({
      ...original,
      id: `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      x: original.x + 20,
      y: original.y + 20,
      zIndex: state.nextZIndex,
    });
    
    set((state) => ({
      shapes: [...state.shapes, newShape],
      nextZIndex: state.nextZIndex + 1,
      selectedShapeId: newShape.id,
    }));
    
    return newShape;
  },
  
  // ============== SELECTION ==============
  
  selectShape: (id) => {
    set({ selectedShapeId: id });
  },
  
  getSelectedShape: () => {
    const state = get();
    return state.shapes.find((s) => s.id === state.selectedShapeId) || null;
  },
  
  // ============== Z-INDEX MANAGEMENT ==============
  
  bringToFront: (id) => {
    set((state) => {
      const maxZ = Math.max(...state.shapes.map((s) => s.zIndex), 0);
      return {
        shapes: state.shapes.map((s) =>
          s.id === id ? { ...s, zIndex: maxZ + 1 } : s
        ),
        nextZIndex: maxZ + 2,
      };
    });
  },
  
  sendToBack: (id) => {
    set((state) => {
      const minZ = Math.min(...state.shapes.map((s) => s.zIndex), 0);
      return {
        shapes: state.shapes.map((s) =>
          s.id === id ? { ...s, zIndex: minZ - 1 } : s
        ),
      };
    });
  },
  
  bringForward: (id) => {
    set((state) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (!shape) return state;
      
      const sortedShapes = [...state.shapes].sort((a, b) => a.zIndex - b.zIndex);
      const currentIndex = sortedShapes.findIndex((s) => s.id === id);
      
      if (currentIndex === sortedShapes.length - 1) return state;
      
      const nextShape = sortedShapes[currentIndex + 1];
      
      return {
        shapes: state.shapes.map((s) => {
          if (s.id === id) return { ...s, zIndex: nextShape.zIndex + 1 };
          return s;
        }),
      };
    });
  },
  
  sendBackward: (id) => {
    set((state) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (!shape) return state;
      
      const sortedShapes = [...state.shapes].sort((a, b) => a.zIndex - b.zIndex);
      const currentIndex = sortedShapes.findIndex((s) => s.id === id);
      
      if (currentIndex === 0) return state;
      
      const prevShape = sortedShapes[currentIndex - 1];
      
      return {
        shapes: state.shapes.map((s) => {
          if (s.id === id) return { ...s, zIndex: prevShape.zIndex - 1 };
          return s;
        }),
      };
    });
  },
  
  // ============== TOOL STATE ==============
  
  setCurrentShapeType: (type) => {
    set({ currentShapeType: type });
  },
  
  setCurrentColor: (color) => {
    set({ currentColor: color });
  },
  
  // ============== BULK OPERATIONS ==============
  
  clearAllShapes: () => {
    set({
      shapes: [],
      nextZIndex: 1,
      selectedShapeId: null,
    });
  },
  
  setShapes: (shapes) => {
    // Validate all shapes when setting
    const validatedShapes = shapes.map(validateShape);
    const maxZ = validatedShapes.length > 0
      ? Math.max(...validatedShapes.map((s) => s.zIndex))
      : 0;
    set({
      shapes: validatedShapes,
      nextZIndex: maxZ + 1,
    });
  },
  
  // ============== SESSION PERSISTENCE ==============
  
  getDrawingLayerState: () => {
    const state = get();
    return {
      shapes: state.shapes,
      nextZIndex: state.nextZIndex,
      version: 1,
    };
  },
  
  loadDrawingLayerState: (layerState) => {
    if (!layerState || !Array.isArray(layerState.shapes)) {
      console.log('[drawingStore] No valid drawing state to load, resetting');
      get().resetDrawingStore();
      return;
    }
    
    // Validate all loaded shapes
    const validatedShapes = layerState.shapes.map(validateShape);
    console.log('[drawingStore] Loading shapes:', validatedShapes.length);
    
    set({
      shapes: validatedShapes,
      nextZIndex: layerState.nextZIndex || validatedShapes.length + 1,
      selectedShapeId: null,
    });
  },
  
  resetDrawingStore: () => {
    set({
      shapes: [],
      nextZIndex: 1,
      selectedShapeId: null,
    });
  },
}));

// ============================================================================
// SELECTOR HOOKS
// Only return primitives to avoid infinite loops
// ============================================================================

export const useSelectedShapeId = () =>
  useDrawingStore((state) => state.selectedShapeId);

export const useHasShapes = () =>
  useDrawingStore((state) => state.shapes.length > 0);

export const useShapesCount = () =>
  useDrawingStore((state) => state.shapes.length);