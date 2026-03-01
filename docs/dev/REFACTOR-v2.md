# Pi Project Memory — Refactor Plan (v2.0)

## Goal

Refactor `pi-decision-memory` into `pi-project-memory`: a simpler, broader memory extension
that mirrors Claude's auto memory model. Drop the JSONL/event-sourcing layer entirely in
favor of human/agent-readable markdown files as the single source of truth.

---

## What Changes vs What Stays

### Deleted
- `store.ts` — JSONL append/read + compact codec
- `indexes.ts` — in-memory index rebuild from events
- All event types in `types.ts` (`DecisionEvent`, `encodeEvent`, `decodeEvent`, etc.)
- `retentionDays` from config — no purge model without timestamps in JSONL

### Rewritten
- `types.ts` — simplified: `MemoryEntry`, `MemoryType`, `MemoryFile`, config types only
- `commands/` — all command handlers rewritten for markdown storage + renamed `/memory`
- `context.ts` — reads from `MEMORY.md` instead of indexes
- `auto-capture.ts` — writes to markdown topic files instead of JSONL
- `index.ts` — remove index loading; keep hooks, simplify `session_start`

### Kept (minor edits only)
- `project-id.ts` — unchanged
- `config.ts` — keep structure, update paths, remove `retentionDays`
- `decision-classifier.ts` — rewritten as `classifier.ts` (extended for all memory types)
- `decision-classifier-llm.ts` — rewritten as `classifier-llm.ts` (extended for all memory types)

---

## New Storage Structure

```
.pi/project-memory/
├── MEMORY.md          ← always-loaded index (≤200 lines), injected at before_agent_start
├── decisions.md       ← architectural/policy decisions
├── patterns.md        ← recurring patterns across sessions
├── preferences.md     ← user/team preferences and conventions
└── gotchas.md         ← project-specific warnings and pitfalls
```

### MEMORY.md format (index)
```markdown
# Project Memory

> Last updated: 2026-03-01

## Decisions (3)
- Use PostgreSQL for primary DB
- Auth via OAuth2 + JWT
- Hexagonal architecture enforced at module boundaries

## Patterns (1)
- API errors always return `{ code, message, details }` shape

## Preferences (2)
- snake_case for all Python identifiers
- Tests live in `__tests__/` next to source files

## Gotchas (1)
- `docker-compose up` requires `.env.local` to exist first
```

### Topic file format (e.g. decisions.md)

Each entry carries a deterministic ID in an HTML comment on the header line.
This is the stable anchor used by `editEntry` and `removeEntry`.

```markdown
# Decisions

## Use PostgreSQL for primary DB <!-- id:a3f1 -->
_Added: 2026-01-10 | Type: decision | Category: tooling | Confidence: 0.92_

We standardize on PostgreSQL. No SQLite or MySQL in new services.

---

## Auth via OAuth2 + JWT <!-- id:b7c2 -->
_Added: 2026-01-15 | Type: decision | Category: architecture_

All services authenticate via OAuth2 with short-lived JWTs.

---
```

ID rules:
- Generated as first 4 chars of `sha1(text + addedAt)`
- If that ID already exists in the topic file, extend to 6 then 8 chars until unique
- Stored inline in the `## Heading <!-- id:xxxx -->` line
- `editEntry(id)` / `removeEntry(id)` locate section by scanning for `<!-- id:xxxx -->`

---

## Storage Helper APIs (no ad-hoc state)

All commands and auto-capture go through these functions only.
No component reads markdown files directly outside `storage/`.

```typescript
// storage/markdown.ts
readTopicFile(dir, topic): MemoryEntry[]
writeEntry(dir, topic, entry): void           // append + rebuildIndex
editEntry(dir, topic, id, newText): void      // in-place edit + rebuildIndex
removeEntry(dir, topic, id): void             // remove section + rebuildIndex
listEntries(dir, topic?): MemoryEntry[]       // all entries, optionally filtered by topic
findEntry(dir, id): MemoryEntry | null        // lookup by id across all topic files
entryExists(dir, text): boolean              // normalized duplicate check

// storage/memory-index.ts
rebuildIndex(dir): void                       // regenerate MEMORY.md from all topic files
injectIndex(dir): string                      // read MEMORY.md for context injection
```

`rebuildIndex` is called internally by every write operation — callers never call it directly.

---

## Classifier v2

### Why LLM classification is more important in v2

Rule-based heuristics catch obvious decisions ("use X", "adopt Y") but fail for softer memory types:

| User says | MemoryType | Rule-catchable? |
|---|---|---|
| "Use PostgreSQL" | decision | Yes — "use X" pattern |
| "We always run migrations before deploy" | gotcha | Barely |
| "I prefer snake_case for filenames" | preference | Weak |
| "The API always returns paginated responses" | pattern | No |
| "Don't forget to seed the DB in CI" | gotcha | Maybe |

The broader memory scope makes LLM classification the primary path, with rules as fallback.

### Classifier output change

**v1 output** (binary decision detection):
```ts
{ isDecision, normalizedText, confidence, category, reason }
```

**v2 output** (memory type classification):
```ts
{ isMemory, memoryType, normalizedText, confidence, category, reason }
//           ^^^^^^^^^^
//  "decision" | "pattern" | "preference" | "gotcha"
```

### LLM classifier system prompt (v2)

The prompt changes from _"is this a durable decision?"_ to:
_"Is this worth remembering for future sessions? If yes, classify what kind of memory it is."_

Expected LLM response shape:
```json
{
  "isMemory": true,
  "memoryType": "gotcha",
  "normalizedText": "Always run migrations before deploying",
  "confidence": 0.91,
  "category": "workflow",
  "reason": "Describes a procedural risk specific to this project"
}
```

### Rule classifier fallback (v2)

Extended heuristics to cover all four memory types:

| Pattern | MemoryType | Confidence |
|---|---|---|
| "use / adopt / standardize on X" | decision | 0.88 |
| "do not / never / avoid X" | decision | 0.86 |
| "architecture / policy / convention" | decision | 0.80 |
| "always / every time / consistently" | pattern | 0.75 |
| "the X always returns / behaves" | pattern | 0.72 |
| "prefer / I like / we like" | preference | 0.74 |
| "don't forget / watch out / be careful" | gotcha | 0.78 |
| "gotcha / footgun / trap / caveat" | gotcha | 0.82 |
| _(unrecognized directive)_ | decision | 0.65 (safe default) |

### Hybrid mode (unchanged)
- LLM classifier runs first
- Falls back to rule classifier if LLM unavailable or times out
- Keeps result with higher confidence
- Silent save if `confidence >= silentThreshold (0.85)`
- Confirm UI if `0.65 <= confidence < 0.85`
- Discard if `confidence < 0.65`

---

## Classifier → MemoryType + Category Mapping

The classifier outputs a `category`. The storage layer maps that to a `memoryType` (= topic file).

| Classifier category | MemoryType | Topic file |
|---|---|---|
| `architecture` | `decision` | `decisions.md` |
| `tooling` | `decision` | `decisions.md` |
| `data` | `decision` | `decisions.md` |
| `policy` | `decision` | `decisions.md` |
| `quality` | `pattern` | `patterns.md` |
| `workflow` | `preference` | `preferences.md` |
| _(unrecognized / low confidence)_ | `decision` | `decisions.md` (safe default) |

`/memory remember <text>` lets users override `memoryType` explicitly with a `--type` flag:
`/memory remember "Always run migrations before deploying" --type gotcha`

---

## Rename Map

| Before | After |
|---|---|
| Package name | `pi-decision-memory` → `pi-project-memory` |
| Extension folder | `extensions/pi-decision-memory/` → `extensions/pi-project-memory/` |
| Command | `/decision` → `/memory` |
| Command alias | — | `/decision` kept as deprecated alias (warns + delegates) |
| Storage path | `.pi/decision-memory/` → `.pi/project-memory/` |
| Config path | `.pi/decision-memory.config.json` → `.pi/project-memory.config.json` |
| Global config | `~/.pi/agent/decision-memory.config.json` → `~/.pi/agent/project-memory.config.json` |
| Test scripts | `test:decision-memory` → `test:project-memory` |
| Version | `0.6.0` → `2.0.0` |

---

## Refactor Phases

### Phase 1 — Rename shell (no logic changes)
- [ ] Rename extension folder: `extensions/pi-decision-memory/` → `extensions/pi-project-memory/`
- [ ] Update `package.json`: name, description, version → `2.0.0`, scripts (`test:project-memory`)
- [ ] Update `pi.extensions` path in `package.json`
- [ ] Rename test files: `tests/decision-memory-*.test.ts` → `tests/project-memory-*.test.ts`
- [ ] Update all internal imports to reflect new paths
- [ ] Verify `tsc --noEmit` passes after rename

### Phase 2 — Delete JSONL layer
- [ ] Delete `store.ts`
- [ ] Delete `indexes.ts`
- [ ] Remove event types from `types.ts`: `DecisionEvent`, `DecisionMemoryState.indexes`, `DecisionCommandDeps` store/index refs
- [ ] Remove `loadEvents` / `buildIndexes` / `appendEvent` calls from `index.ts`
- [ ] Remove `retentionDays` from config types and `getDefaultConfig()`
- [ ] Simplify `session_start`: only load config + resolve project identity
- [ ] Verify nothing imports deleted modules

### Phase 3 — New markdown storage layer
- [ ] Create `storage/markdown.ts` with the full helper API defined above
- [ ] Create `storage/memory-index.ts` with `rebuildIndex` + `injectIndex`
- [ ] Implement entry ID generation: `sha1(text + addedAt).slice(0, 4)`; if that ID already exists in the topic file, extend to 6 then 8 chars until unique
- [ ] Implement ID-based lookup via `<!-- id:xxxx -->` header scanning
- [ ] Ensure storage dir is created on first write (`mkdir -p`)
- [ ] `rebuildIndex` called internally by all write helpers — never by callers

### Phase 3b — Test scaffolding (storage layer)
- [ ] Add `tests/project-memory-storage.test.ts`:
  - `writeEntry` → file created, entry section appears with ID comment
  - `editEntry` → heading preserved, body updated, ID unchanged
  - `removeEntry` → section gone, surrounding entries intact
  - `findEntry` → finds entry by ID across topic files
  - `entryExists` → normalized duplicate detection
- [ ] Add `tests/project-memory-index.test.ts`:
  - `rebuildIndex` → MEMORY.md reflects current topic file contents
  - `injectIndex` → returns MEMORY.md content within char budget
- [ ] Verify tests pass before moving to Phase 4

### Phase 4 — Simplified types
- [ ] Rewrite `types.ts`:
  - `MemoryType`: `"decision" | "pattern" | "preference" | "gotcha"`
  - `MemoryEntry`: `{ id, text, type: MemoryType, category, confidence?, source?, addedAt, tags? }`
  - `MemoryConfig`: remove `retentionDays`; keep `autoCapture`, `context`, `enabled`
  - `MemoryState`: `{ config, projectIdentity, ready }` (no indexes, no pending events)
  - `MemoryCommandDeps`: `{ state, storage: StorageAPI }` (typed storage handle, no store/index)

### Phase 5 — Rewrite commands
- [ ] Rename command registration: `/decision` → `/memory`
- [ ] Add deprecated `/decision` alias: warns user, delegates to `/memory` handler
- [ ] Rewrite `command-add.ts` → `writeEntry(decisions.md)` + index auto-rebuilds
- [ ] Rewrite `command-list.ts` → `listEntries()` per topic, format output
- [ ] Rewrite `command-search.ts` → text search via `listEntries()` across all topics
- [ ] Rewrite `command-edit.ts` → `editEntry(id)` by ID
- [ ] Rewrite `command-remove.ts` → `removeEntry(id)` by ID
- [ ] Rewrite `command-supersede.ts` → `removeEntry(oldId)` + `writeEntry(newText)`
- [ ] Delete `command-purge.ts` (no retention without JSONL; `/memory clear` replaces it)
- [ ] Keep `command-reset.ts` → delete all topic files + MEMORY.md
- [ ] Keep `command-enable.ts` / `command-disable.ts` — update config paths only
- [ ] Add `command-remember.ts` → `/memory remember <text> [--type decision|pattern|preference|gotcha]`
- [ ] Add `command-consolidate.ts` → LLM pass to merge related entries across topic files

### Phase 6 — Update auto-capture
- [ ] Update `auto-capture.ts`: replace `appendEvent()` with `writeEntry()` routed by classifier category → memoryType mapping table
- [ ] Silent-save when `confidence >= 0.85`; show confirm UI for `0.65–0.84`
- [ ] `rebuildIndex` happens automatically inside `writeEntry` — no extra call needed

### Phase 7 — Update context injection
- [ ] Update `context.ts`: call `injectIndex(dir)` to get MEMORY.md content
- [ ] Keep char budget: MEMORY.md ≤200 lines by construction; inject ≤2200 chars
- [ ] Inject MEMORY.md verbatim as "Project memory" system prompt section

### Phase 8 — Update config
- [ ] Update all paths in `config.ts` to `project-memory`
- [ ] Remove `retentionDays` from config schema and defaults
- [ ] Add `autoCapture.silentThreshold` (default `0.85`)
- [ ] Update `getDefaultConfig()` and merge logic

### Phase 9 — Remaining tests
- [ ] Update command tests to use markdown storage mocks (not JSONL fixtures)
- [ ] Update auto-capture tests: assert `writeEntry` called with correct topic
- [ ] Update context injection tests: mock `injectIndex` return value
- [ ] Update config tests: verify `retentionDays` no longer exists
- [ ] Add alias test: `/decision add` routes to `/memory add` with deprecation warning
- [ ] Verify full suite: `npm run test:project-memory`

### Phase 10 — Docs + release
- [ ] Update `README.md`: new name, `/memory` command examples, storage diagram
- [ ] Update `IMPLEMENTATION.md`: reflect markdown-only architecture
- [ ] Update `CHANGELOG.md`: v2.0.0 breaking changes
- [ ] Run `npm run check` clean pass
- [ ] Tag release `v2.0.0`

---

## Migration Note for Existing Users

Since `"private": true` and no external distribution exists, no migration path is needed.
Existing `.pi/decision-memory/` folders can be left in place (ignored by new extension).

---

## Key Simplifications Gained

| Was | Now |
|---|---|
| Append-only JSONL + codec | In-place markdown edits |
| In-memory index rebuild | Read markdown directly |
| Two formats in sync | Single source of truth |
| `store.ts` + `indexes.ts` + codec | `storage/markdown.ts` + `storage/memory-index.ts` |
| Complex event types | Simple `MemoryEntry` struct |
| Ad-hoc state for lookup | Typed `StorageAPI` used everywhere |
| `/decision` (decisions only) | `/memory` (decisions, patterns, preferences, gotchas) |
| `retentionDays` purge policy | Entries live until explicitly removed |
