import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { DrawObjectShape, DrawObjectStyle, DEFAULT_DRAW_STYLE } from "@/types/DrawObject";

/**
 * Which canvas layer is currently active.
 */
export type CanvasLayer = "plan" | "draw";

/**
 * The active drawing tool.
 * 'select' is the pointer/selection tool; shape values create new objects.
 */
export type DrawTool = "select" | DrawObjectShape;

interface DrawUIState {
  /** Which layer is currently active */
  activeLayer: CanvasLayer;
  /** Which draw tool is currently selected */
  activeDrawTool: DrawTool;
  /** Default style applied to newly created draw objects */
  defaultStyle: DrawObjectStyle;

  setActiveLayer: (layer: CanvasLayer) => void;
  setActiveDrawTool: (tool: DrawTool) => void;
  setDefaultStyle: (style: Partial<DrawObjectStyle>) => void;
}

/**
 * Ephemeral UI state for the draw layer.
 * Not persisted to localStorage (like historyStore).
 * Cleared when navigating away from the session page.
 */
export const useDrawUIStore = create<DrawUIState>()(
  devtools(
    (set) => ({
      activeLayer: "plan",
      activeDrawTool: "select",
      defaultStyle: { ...DEFAULT_DRAW_STYLE },

      setActiveLayer: (layer) => set({ activeLayer: layer }),

      setActiveDrawTool: (tool) => set({ activeDrawTool: tool }),

      setDefaultStyle: (style) =>
        set((state) => ({
          defaultStyle: { ...state.defaultStyle, ...style },
        })),
    }),
    { name: "draw-ui-store" }
  )
);
