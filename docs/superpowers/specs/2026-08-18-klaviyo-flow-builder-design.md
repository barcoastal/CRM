# Klaviyo-Style Flow Builder Design

Date: 2026-08-18
Status: Approved by Bar (design conversation, 2026-08-18)

## Goal

Replace the Email Center's flow-authoring entry point (currently the old SLDS canvas at `/automation/flows`) with a Klaviyo-style vertical flow builder inside the Email Center: a Trigger card at the top, a top-to-bottom spine of step cards with "+" insert buttons between them, Conditional Split steps that fork into Yes/No branch columns, and the monochrome Email Center styling. It edits the same `Flow` records the existing engine already executes; execution is unchanged.

## Decisions (locked)

1. **Conditional splits in v1** (full branching, Yes/No columns, nestable).
2. **Step palette**: Send Email, Wait/Delay, Update Record, Create Task, Conditional Split. No SMS (Phase 2).
3. **New routes** `/email-center/flows/new` and `/email-center/flows/[id]`; the Email Center Flows list points here. The old `/automation/flows` canvas stays untouched for the rest of the CRM.
4. **Same data model**: reads/writes `Flow` (name, description, entityType, triggerEvent, entryCriteria, triggerOnFieldChanges, reentryPolicy, reentryCooldownDays, inactivityDays, isActive, graph) via the existing `POST /api/flows` and `PATCH /api/flows/[id]` (both already accept every field needed; NO API changes).

## Key insight: the graph is a tree

The engine's `FlowGraph { nodes, edges }` is walked from the `start` node. Klaviyo branches do not rejoin (each Yes/No path runs to its own `end`), so a builder-authored flow is a **tree** rooted at `start`. A tree renders naturally as a vertical sequence:

- A linear chain of single-child nodes = a vertical stack of step cards.
- A `decision` node = a Conditional Split card, below which two columns (Yes = the `true` branch edge's subtree, No = the `false` branch edge's subtree) render recursively, each ending in an End cap.

The builder parses the flat graph into this tree to render, and serializes the tree back to `{ nodes, edges }` (with auto-computed positions) to save. Because the serialized shape is exactly what the executor already walks (a `decision` node with `true`/`false` branch edges), execution needs no changes, and a builder-made flow still opens in the old canvas.

## Architecture

### Pure core: `src/lib/flow/flow-tree.ts` (TDD)

The testable heart. No React, no DB.

- `FlowTreeNode` type: `{ id, kind, label, config, children: { branch?: string; node: FlowTreeNode }[] }` (or `null` for an End leaf). A linear step has one child; a decision has two children keyed by branch `"true"`/`"false"`; an end has none.
- `graphToTree(graph: FlowGraph): FlowTreeNode` - walk from the start node following edges; attach decision children by their edge `branch`. Tolerates a legacy free-form graph by following edges depth-first; cycles are broken (visited set) so it never loops.
- `treeToGraph(tree: FlowTreeNode): FlowGraph` - flatten back to nodes + edges, assigning `branch` on decision out-edges, and computing `position { x, y }` via a vertical layout (y by depth, x by branch column) so the old canvas can still render it.
- Mutations (pure, return a new tree): `insertStep(tree, afterNodeId, newNode)`, `insertStepOnBranch(tree, decisionId, branch, newNode)`, `deleteStep(tree, nodeId)` (splices the node out, reconnecting its single child; deleting a decision deletes its whole subtree with confirmation at the UI layer), `addSplit(tree, afterNodeId)` (inserts a decision node with two empty End-capped branches), `updateNodeConfig(tree, nodeId, config)`.
- `newNode(kind): FlowTreeNode` - builds a node with a cuid-free deterministic id is NOT possible (Math.random/Date banned in some contexts, but this is app runtime not a workflow script, so `crypto.randomUUID()` is fine) and the default config from `DEFAULT_NODE_CONFIG`.

### New-flow setup: `src/app/(dashboard)/email-center/flows/new/`

`page.tsx` (server, admin/login gated) + `new-flow-client.tsx`: a Klaviyo-styled card collecting name, entity (Lead/Contact/...), trigger type (created / updated / inactivity + days), and re-entry policy. POSTs to `/api/flows`, then routes to `/email-center/flows/[id]`.

### Builder: `src/app/(dashboard)/email-center/flows/[id]/`

`page.tsx` (server): loads the flow, passes a snapshot to the client. `builder-client.tsx`: the vertical builder. Sub-components (each its own file under `src/components/email/flow-builder/`):

- `TriggerCard` - shows "When a {Entity} is {trigger}", edits entity/trigger/entryCriteria/reentry (opens the config drawer).
- `StepSpine` - recursively renders a `FlowTreeNode`: a `StepCard` per node, an `AddStepButton` ("+") between nodes, and for a decision node a `BranchColumns` wrapper with two labeled `StepSpine`s.
- `StepCard` - one card per kind with an icon, label, and a one-line summary of its config; click opens the config drawer.
- `AddStepButton` - the "+" with a popover menu (Send Email / Wait / Update Record / Create Task / Conditional Split).
- `StepConfigDrawer` - right drawer; renders the config form for the selected step kind (Send Email: template + fromMode + toFieldPath; Wait: N hours/days; Update Record: field/value rows; Create Task: subject/assignee/dueOffset; Conditional Split: a condition builder reusing the `ListFilter`/segment-style field/op/value rows).

The builder holds the tree in state, derives it from `initial.graph` via `graphToTree`, and on Save calls `treeToGraph` and PATCHes `/api/flows/[id]` with graph + trigger fields. A header has the flow name, a Live/Draft toggle, and a Save button (dirty-state aware). Condition/entry-criteria builders reuse the same `{ field, op, value }` shape used by Segments (Phase 1b) for consistency.

### Repoint the Email Center Flows list

`src/app/(dashboard)/email-center/flows/flows-client.tsx`: change "New Flow" to `/email-center/flows/new` and the row link to `/email-center/flows/[id]`. The "Report" link stays as-is.

### Styling

New `.ec-fb-*` classes appended to `email-center.css` (spine line, step card, + button, branch columns, drawer). Monochrome: white cards on the canvas, black spine line, lime accent on the active/selected card and the trigger, `.ec-btn-primary` for Save.

## Data flow

1. Load: server reads `Flow` -> `builder-client` receives `{ id, name, ...triggerFields, graph }` -> `graphToTree(graph)` -> render.
2. Edit: "+"/config mutate the tree in state (dirty = true).
3. Save: `treeToGraph(tree)` -> `PATCH /api/flows/[id] { name, entityType, triggerEvent, entryCriteria, triggerOnFieldChanges, reentryPolicy, reentryCooldownDays, inactivityDays, isActive, graph }` -> dirty = false.
4. Execution: unchanged. The next trigger/sweep/poll runs the saved graph through the existing executor.

## Error handling

- `graphToTree` on a malformed/empty graph returns a minimal `start -> end` tree so a brand-new or corrupt flow still opens editable.
- Deleting a Conditional Split warns (it removes both branches) at the UI layer.
- Save failures surface the API error inline; the tree state is preserved so no work is lost.
- A flow with no steps (just start -> end) saves fine and simply does nothing when triggered (matches current behavior).
- Cycle guard in `graphToTree` (visited set) prevents infinite loops on a legacy canvas graph that has a back-edge.

## Testing

- Unit (vitest, pure): `flow-tree.ts` round-trip (`treeToGraph(graphToTree(g))` preserves reachable nodes/edges + branch labels), each mutation (insert linear, insert on branch, delete step reconnects child, addSplit produces a decision with two End-capped branches), layout assigns distinct positions, cycle guard.
- Integration: a builder-produced graph, when saved and run through the existing executor (dry-run), reaches the expected nodes; a decision serializes to valid `true`/`false` edges the executor's `nextEdge` follows.
- E2E (browser): create a flow in the Email Center, add Send Email + Wait + a Conditional Split with two branches, configure each, Save; reload and confirm the tree round-trips; toggle Live; confirm the saved graph runs (seed a matching record and dry-run or trigger).

## Out of scope

- SMS steps (Phase 2), branch rejoining (branches always run to their own end), A/B split test steps, drag-to-reorder (v1 uses insert/delete; reorder is a follow-up), analytics overlays on the builder (the flow report already exists at `/email-center/flows/[id]/report`).

## Open risks

- Deeply nested splits render wide. Mitigation: horizontal scroll on the canvas and a sane per-column min-width; refine spacing after seeing it live. Not blocking.
- The old `/automation/flows` canvas and the new builder both edit the same `Flow.graph`. A flow edited in the vertical builder gets auto-layout positions; if later opened in the old canvas the node positions are the computed vertical layout (usable, just not hand-arranged). Acceptable and expected.
