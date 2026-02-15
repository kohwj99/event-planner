# CLAUDE.md - Project Guidelines

## Project Overview

Event and seat planning application built with Next.js (App Router), TypeScript (strict), Zustand, D3.js, and Material UI.

## Tech Stack

- **Framework:** Next.js 15.5.4 (App Router, Turbopack)
- **Language:** TypeScript 5 (strict mode enabled)
- **UI:** Material UI (MUI) 7, Emotion CSS-in-JS, Tailwind CSS 4
- **State:** Zustand 5 with devtools + persist middleware (localStorage)
- **Visualization:** D3.js 7 (SVG-based seat/table rendering)
- **React:** 19.1.0
- **Export:** jspdf, pptxgenjs, html2canvas, xlsx, papaparse
- **Other:** chroma-js (colors), uuid, react-konva (legacy, not actively used)

## Git Workflow

- **Base branch:** `feature/canvas-history` (use this for PRs, not `main`)
- Branch off from and merge back into `feature/canvas-history`

## Commands

- `npm run dev` - Start dev server (Turbopack)
- `npm run build` - Production build (Turbopack)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
app/                        # Next.js App Router pages
  events/[id]/              # Event detail page
  session/[id]/             # Session seat planning page
components/
  atoms/                    # Basic building blocks
  molecules/                # Composite components (modals, cards)
  organisms/                # Complex sections (PlaygroundCanvas, panels)
  providers/                # StoreHydrationProvider
  registry/                 # ThemeRegistry, StoreInitializer
hooks/                      # useHydration, useSessionLoader, useSnackbar
store/                      # Zustand stores
  eventStore.ts             # Events, sessions, days
  seatStore.ts              # Tables, chunks, seats, guest assignments
  templateStoreV2.ts        # Seating templates
  guestStore.ts             # Guest list management
  colorModeStore.ts         # Color scheme (normal, colorblind, dark)
types/                      # TypeScript type definitions
  Event.ts                  # Event, Session, ProximityRules, etc.
  TemplateV2.ts             # Template types
  Seat.ts, Table.ts, Chunk.ts
utils/                      # Algorithms and helpers
  seatAutoFillHelper.tsx    # Core seat assignment algorithm
  tableSVGHelper.ts         # D3/SVG rendering for tables/seats
  violationDetector.ts      # Proximity rule violation checks
  adjacencyHelper.ts        # Guest adjacency & VIP exposure
  templateScalerV2.ts       # Template scaling logic
  exportToPDF.ts, exportToPPTX.ts
```

## Architecture Patterns

- **Client-side heavy:** Components use `"use client"` extensively
- **Atomic design:** atoms -> molecules -> organisms hierarchy
- **Zustand stores** persist to localStorage; hydration handled via StoreHydrationProvider
- **D3 visualization** in PlaygroundCanvas.tsx (organisms) with helpers in utils/tableSVGHelper.ts
- **Path alias:** `@/*` maps to project root

## Coding Conventions

- **Strict TypeScript** - No `any` types. All new code must be fully typed.
- **No emojis** in code, comments, or UI text.
- **No breaking changes** to existing features unless explicitly specified.
- **MUI components** for all UI elements (buttons, modals, forms, etc.)
- **Zustand** for all state management. Follow existing store patterns (devtools + persist middleware).
- **D3.js** for all table/seat SVG visualization. Do not introduce new visualization libraries.
- **Atomic design** - Place new components in the appropriate atoms/molecules/organisms folder.
- **Standalone output** - Next.js is configured for Docker containerization (`output: "standalone"`).

## Key Domain Concepts

- **Event** - Top-level entity containing multiple EventDays
- **EventDay** - A day within an event containing multiple Sessions
- **Session** - A seating arrangement instance with tables, seats, and guest assignments
- **Table** - Round or rectangular, composed of Seats arranged in Chunks
- **Chunk** - Grid-based coordinate grouping for table positioning
- **Seat** - Individual position at a table, assignable to a guest
- **Template** - Reusable seating layout that can be scaled
- **ProximityRules** - Sit-together and sit-away constraints between guests
- **Guest Ranking** - VIP system for prioritized seating
