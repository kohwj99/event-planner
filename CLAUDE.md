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
- **Testing:** Vitest 4 with V8 coverage
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
- `npm run test` - Run tests once (Vitest)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with V8 coverage

## Project Structure

```
app/                        # Next.js App Router pages
  events/[id]/              # Event detail page
  session/[id]/             # Session seat planning page
components/
  atoms/                    # Basic building blocks
  molecules/                # Composite components (modals, cards)
  organisms/                # Complex sections (PlaygroundCanvas, panels)
  providers/                # StoreHydrationProvider, UndoRedoProvider
  registry/                 # ThemeRegistry, StoreInitializer
hooks/                      # Custom React hooks
  useHydration.ts           # Store hydration state
  useSessionLoader.ts       # Session data loading
  useSnackbar.ts            # Snackbar notifications
  useUndoRedo.ts            # Undo/redo with snapshot capture
store/                      # Zustand stores
  eventStore.ts             # Events, sessions, days
  seatStore.ts              # Tables, chunks, seats, guest assignments
  templateStoreV2.ts        # Seating templates
  guestStore.ts             # Guest list management
  colorModeStore.ts         # Color scheme (normal, colorblind, dark)
  historyStore.ts           # Undo/redo history (snapshots, action labels)
types/                      # TypeScript type definitions
  Event.ts                  # Event, Session, ProximityRules, etc.
  TemplateV2.ts             # Template types
  Seat.ts, Table.ts, Chunk.ts
utils/                      # Algorithms and helpers
  autoFill/                 # Modular seat assignment system (see below)
  tableSVGHelper.ts         # D3/SVG rendering for tables/seats
  violationDetector.ts      # Proximity rule violation checks
  adjacencyHelper.ts        # Guest adjacency & VIP exposure
  templateScalerV2.ts       # Template scaling logic
  colorConfig.ts            # Color configuration
  eventImportUtils.ts       # Event import utilities
  eventStatisticHelper.ts   # Event statistics calculations
  generateTable.ts          # Table generation helper
  seatValidation.ts         # Seat validation logic
  swapHelper.ts             # Seat swap helper
  tableGeometryHelper.ts    # Table geometry calculations
  templateImportExportHelper.ts  # Template import/export
  trackingHelper.ts         # Event tracking
  chunkHelper.ts            # Chunk positioning utilities
  exportToPDF.ts            # PDF export
  exportToPPTX.ts           # PowerPoint export
__tests__/                  # Test suite (see Testing section)
```

### AutoFill Module (`utils/autoFill/`)

The seat assignment algorithm has been refactored from a monolithic `seatAutoFillHelper.tsx` into a modular system. Backward compatibility is maintained via a barrel export in `index.ts`.

```
utils/autoFill/
  index.ts                  # Barrel export (public API, backward compatible)
  autoFillOrchestrator.ts   # Main orchestrator coordinating the pipeline
  autoFillTypes.ts          # Type definitions for autoFill system
  clusterBuilder.ts         # Build sit-together guest clusters
  guestPoolBuilder.ts       # Build and prepare guest pools
  guestSorting.ts           # Guest sorting logic (randomize, comparators)
  initialPlacement.ts       # Initial guest-to-seat placement
  lockedGuestHelpers.ts     # Handle locked/pre-assigned guests
  proximityRuleHelpers.ts   # Proximity rule utility functions
  seatCompatibility.ts      # Seat compatibility checks
  seatFinder.ts             # Find available seats for guests
  sitAwayOptimization.ts    # Sit-away constraint optimization pass
  sitTogetherOptimization.ts # Sit-together constraint optimization pass
  unionFind.ts              # Union-find data structure for clustering
  violationChecker.ts       # Violation detection for assignments
```

## Testing

- **Framework:** Vitest 4 with V8 coverage provider
- **Config:** `vitest.config.ts`
- **Setup:** `__tests__/setup.ts` (suppresses console output during tests)
- **Coverage target:** `utils/autoFill/**` (excluding barrel `index.ts`)

### Test Structure

```
__tests__/
  autoFill/
    unit/                   # Unit tests for each autoFill module
      clusterBuilder.test.ts
      guestPoolBuilder.test.ts
      guestSorting.test.ts
      initialPlacement.test.ts
      lockedGuestHelpers.test.ts
      proximityRuleHelpers.test.ts
      seatCompatibility.test.ts
      seatFinder.test.ts
      sitAwayOptimization.test.ts
      sitTogetherOptimization.test.ts
      unionFind.test.ts
      violationChecker.test.ts
    integration/            # Full pipeline tests
      fullPipeline.test.ts
    factories/              # Test data factories
      guestFactory.ts
      rulesFactory.ts
      seatFactory.ts
      tableFactory.ts
    helpers/                # Test utilities
      assertions.ts
      tableLayouts.ts
  setup.ts                  # Global test setup
```

## Architecture Patterns

- **Client-side heavy:** Components use `"use client"` extensively
- **Atomic design:** atoms -> molecules -> organisms hierarchy
- **Zustand stores** persist to localStorage; hydration handled via StoreHydrationProvider
- **Undo/redo** via historyStore + UndoRedoProvider + useUndoRedo hook (snapshot-based)
- **D3 visualization** in PlaygroundCanvas.tsx (organisms) with helpers in utils/tableSVGHelper.ts
- **Modular autoFill** pipeline with orchestrator pattern and individual optimization passes
- **Path alias:** `@/*` maps to project root

## Docker

- **Dockerfile** in project root with multi-stage build
- **Base images:** `gdssingapore/airbase:node-20-builder` (build) / `gdssingapore/airbase:node-20` (runtime)
- **Output:** Next.js standalone mode for containerized deployment

## Coding Conventions

- **Strict TypeScript** - No `any` types. All new code must be fully typed.
- **No emojis** in code, comments, or UI text.
- **No breaking changes** to existing features unless explicitly specified.
- **MUI components** for all UI elements (buttons, modals, forms, etc.)
- **Zustand** for all state management. Follow existing store patterns (devtools + persist middleware).
- **D3.js** for all table/seat SVG visualization. Do not introduce new visualization libraries.
- **Atomic design** - Place new components in the appropriate atoms/molecules/organisms folder.
- **Standalone output** - Next.js is configured for Docker containerization (`output: "standalone"`).
- **Test new utils** - New utility functions in `utils/autoFill/` should have corresponding unit tests using the existing factory and helper patterns in `__tests__/`.

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
