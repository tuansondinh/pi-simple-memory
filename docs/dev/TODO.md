- [x] Confirm extension location and naming (`extensions/pi-decision-memory`)
- [x] Create standalone package at project root (`package.json`)
- [x] Add `pi` manifest in package.json (`"pi": { "extensions": ["./extensions"] }`)
- [x] Add required test/tooling packages (`vitest`, `tsx`, `typescript`, `@types/node`)
- [x] Move tests into standalone package (`tests/*.test.ts`)
- [x] Simplify storage to one canonical project-local file (`<project>/.pi/decision-memory/decisions.jsonl`)
- [x] Remove global project-memory file usage from runtime code
- [x] Create scaffold files:
- [x] `index.ts` (default export extension function)
- [x] `types.ts` (event + decision + config types)
- [x] `config.ts` (global/project config load + merge)
- [x] `project-id.ts` (git-root/cwd resolution + hash)
- [x] `store.ts` (JSONL append/read + compact codec)
- [x] `indexes.ts` (in-memory `byId` + optional `byStatus`/`byTag`)
- [x] `commands/index.ts` (`/decision` command registration + routing)
- [x] Split command logic into single-responsibility files under `commands/` (`commands/*.ts`)
- [x] `context.ts` (`before_agent_start` token-safe injection)
- [x] Implement compact on-disk event codec:
- [x] `encodeEvent` writes compact keys (`t,p,e,i,d,u` + nested short keys)
- [x] `decodeEvent` restores readable runtime shape
- [x] Keep schema versioning (`v`) and validation guards
- [x] Centralize default values via config defaults (`getDefaultConfig`) to avoid duplication
- [x] Implement session initialization (`session_start`):
- [x] Load global config (`~/.pi/agent/decision-memory.config.json`)
- [x] Resolve project identity (git root -> cwd fallback)
- [x] Load project config (`<project>/.pi/decision-memory.config.json`)
- [x] Compute effective `enabled` + merged `retentionDays`
- [x] Load/replay JSONL and build runtime indexes
- [x] Implement command: `/decision help`
- [x] Implement command: `/decision status`
- [x] Implement command: `/decision add <text>`
- [x] Implement command: `/decision list`
- [x] Implement command: `/decision search <query>`
- [x] Implement command: `/decision edit <id> <text>`
- [x] Implement command: `/decision remove <id>`
- [x] Implement command: `/decision supersede <oldId> <newText>`
- [x] Implement command: `/decision purge` with confirmation + retention policy
- [x] Implement command: `/decision reset|clear [--yes]` to clear all decisions
- [x] Implement command: `/decision enable --global`
- [x] Implement command: `/decision disable --global`
- [x] Implement command: `/decision enable --project`
- [x] Implement command: `/decision disable --project`
- [x] Implement auto-capture (explicit user `Decision:` markers)
- [x] Add `autoCapture` config (`enabled`, `confirm`, `maxPerTurn`)
- [x] Hook auto-capture on `before_agent_start`
- [x] Skip duplicates against active decisions during auto-capture
- [x] Enforce disabled behavior:
- [x] No context injection when disabled
- [x] No memory writes when disabled
- [x] Mutating commands return clear disabled message
- [x] Implement duplicate/conflict handling:
- [x] Normalize text for duplicate detection
- [x] Prompt options: update existing / force create / cancel
- [x] Conflict options: supersede / keep+mark conflict / cancel
- [x] Enforce token-aware injection limits:
- [x] Active-only decisions
- [x] Latest N configurable via `context.maxDecisions` (default 20, max 20)
- [x] `maxCharsPerDecision = 160`
- [x] `maxSectionChars = 2200`
- [x] Compact line format in prompt (`D-xxxx | short text | #tags`)
- [x] Add recovery behavior:
- [x] Rebuild indexes from JSONL on startup
- [x] Regenerate indexes if missing/corrupt
- [x] Add documentation:
- [x] Update extension README with usage/examples
- [x] Document compact disk schema + codec map
- [x] Document config fields + defaults + retention rules
- [x] Add tests:
- [x] Keep tests single-responsibility (split by module/command area)
- [x] Implemented test file: `tests/decision-memory-config-context.test.ts`
- [x] Covers: config defaults, global/project merge precedence, global disabled override, `context.maxDecisions` clamp, context injection active-only + disabled behavior
- [x] Implemented test file: `tests/decision-memory-store.test.ts`
- [x] Covers: compact codec encode/decode, JSONL load filtering invalid lines
- [x] Implemented test file: `tests/decision-memory-indexes.test.ts`
- [x] Covers: index replay/apply behavior
- [x] Implemented test file: `tests/decision-memory-commands-basic.test.ts`
- [x] Covers: `/decision add|list|search`
- [x] Implemented test file: `tests/decision-memory-commands-mutations.test.ts`
- [x] Covers: `/decision edit|remove|supersede|purge` including confirmation path
- [x] Implemented test file: `tests/decision-memory-commands-duplicate-conflict.test.ts`
- [x] Covers: duplicate detection + user options, conflict handling options
- [x] Implemented test file: `tests/decision-memory-commands-toggle-disabled.test.ts`
- [x] Covers: `/decision enable|disable`, mutating blocked when disabled, no write when disabled
- [x] Implemented test file: `tests/decision-memory-auto-capture.test.ts`
- [x] Covers: auto-capture extraction, confirmation, maxPerTurn limit, duplicate skip, disabled behavior
- [x] Implemented test file: `tests/decision-memory-project-id.test.ts`
- [x] Covers: project identity resolution (`git rev-parse` success + fallback to cwd)
- [x] Implemented test file: `tests/decision-memory-disabled-e2e.test.ts`
- [x] Covers: disabled mode end-to-end (no writes + no injection + auto-capture blocked)
- [x] Implemented test file: `tests/decision-memory-recovery.test.ts`
- [x] Covers: JSONL replay rebuild, corrupt-line tolerance/regeneration
- [x] To implement test: auto-capture flow (`before_agent_start` explicit `Decision:` extraction, confirm path, duplicate skip)
- [x] To implement test: `/decision edit` flow (event append + in-memory update)
- [x] To implement test: `/decision remove` flow (event append + index removal)
- [x] To implement test: `/decision supersede` flow (old -> superseded, new -> active)
- [x] To implement test: `/decision purge` retention behavior + confirmation path
- [x] To implement test: `/decision reset|clear --yes` clears all decisions
- [x] To implement test: duplicate/conflict detection options and outcomes
- [x] To implement test: disabled mode end-to-end (no writes + no injection)
- [x] Run checks from repo root/package root: `npm run test:decision-memory` + `npx tsc --noEmit`
- [x] Run only targeted tests if requested
- [x] Final pre-PR pass:
- [x] Verify file paths and naming consistency
- [x] Verify backward-compatible defaults (`enabled: true`)
- [x] Verify no unintended API or behavior regressions
- [x] Prepare PR:
- [x] Summarize scope, storage model, and token-aware behavior
- [x] Include test evidence and known limitations
- [x] Ensure changes are limited to relevant files only
- [x] Keep this TODO file updated after every completed step
- [x] Set up SemVer/changelog tooling from Conventional Commits (`standard-version`, `conventional-changelog-cli`)
- [x] Add release scripts with required checks before versioning

## Next Iteration: Auto-capture v2 (post-run, multi-select)

- [x] Extract decision/order candidates from user prompt on `before_agent_start`
- [x] Add in-memory pending-candidates state for current turn/session
- [x] Trigger capture confirmation on `agent_end` (after work is done)
- [x] Implement multi-select review UI to choose which candidates to save
- [x] Fallback to sequential Yes/No confirms when multi-select is unavailable
- [x] Persist only selected candidates as add events
- [x] Enforce duplicate checks before prompt and before persist
- [x] Skip post-run capture prompt on failed/cancelled runs
- [x] Add tests for multi-candidate selection behavior
- [x] Add tests for fallback confirm behavior (no multi-select)
- [x] Update README with post-run confirmation flow and examples

## Next Iteration: Intelligent decision detection

- [x] Keep current rule-based extractor as fallback path
- [x] Add rule-based classifier for candidate lines (durable decision vs transient instruction)
- [x] Require structured classifier output: `{isDecision, normalizedText, confidence, category, reason}`
- [x] Keep only high-confidence classifier candidates for review
- [x] Feed normalized classifier text into post-run multi-select review
- [x] Preserve existing duplicate checks before persist
- [x] Add optional metadata on persisted decisions (source + confidence + category)
- [x] Add tests for classifier gating and transient-instruction rejection
- [x] Add docs for classifier behavior, confidence thresholds, and fallback rules
- [x] Add LLM-backed classifier mode for richer semantic detection (with fallback to rule classifier)

## Next Iteration: Auto Memory parity

### Markdown memory layer (markdown-only, no JSONL)
- [x] Define storage structure under `.pi/project-memory/`:
  - `MEMORY.md` — concise always-loaded index (≤200 lines), injected at `before_agent_start`
  - `decisions.md` — active decisions, human/agent-readable
  - `patterns.md` — recurring patterns detected across sessions
  - `preferences.md` — user/team preferences and conventions
  - `gotchas.md` — project-specific warnings and known pitfalls
- [x] Drop JSONL entirely — markdown files are the single source of truth
- [x] All writes are in-place edits to the relevant markdown file (add section, update entry, remove line)
- [x] `MEMORY.md` is a table-of-contents: one-line summary per topic file + entry counts
- [x] On `session_start`: inject `MEMORY.md` into context; load topic files on demand when relevant
- [x] Remove `store.ts`, compact codec, and index-rebuild logic (no longer needed)
- [x] Remove `indexes.ts` — state is read directly from markdown files

### Broader capture scope (beyond "decisions")
- [x] Extend memory types: preferences, recurring patterns, debugging insights, project-specific gotchas, team conventions
- [x] Add `memoryType` field alongside existing `category`: `decision | preference | pattern | gotcha | convention`
- [x] Update classifier to detect non-decision memory types (e.g. "I always use snake_case", "tests go in `__tests__/`")
- [x] Add `/memory remember <text> [--type ...]` as the single capture command (replaces `/decision remember`)

### Reduce confirmation friction
- [x] Auto-save silently when `confidence >= silentThreshold` (no user prompt)
- [x] Only show confirmation UI for `confidenceThreshold–silentThreshold` range
- [x] Add config option `autoCapture.silentThreshold` (default `0.85`)
- [x] Add tests for silent-save vs confirm-save branching

### Mid-conversation capture
- [ ] Hook `turn_end` event (fires after each LLM turn mid-agent-run) to run classifier on the assistant message
- [ ] Silently persist high-confidence memories found mid-turn without interrupting the agent
- [ ] Handle interrupted sessions gracefully (mid-session saves are not lost)
- [ ] Available events (from pi SDK): `turn_end` (message + toolResults per turn), `message_end` (per assistant message), `tool_execution_end` (per tool call)

### Smart update vs append
- [x] Before appending a new memory, check if an existing active entry covers the same ground (duplicate check via normalized text)
- [x] If match found: skip with warning rather than create duplicate
- [ ] If match found: offer to edit existing entry rather than skip (use normalized similarity)
- [ ] Add semantic consolidation: LLM pass to merge related entries into higher-level patterns

### Active mid-conversation recall
- [ ] Add semantic search at recall time (not just tag/status filter) to surface the most relevant memories for the current prompt

## Next Iteration: Structure auto-capture

- [x] Reject task-request prompts from auto-capture classifier (`can`, `scan`, `tell me`, `check`, `analyze`)
- [x] Extract folder/file structure blocks from agent response (`extractStructureCandidates`)
- [x] Detect Unicode tree chars (`├──`, `└──`, `│`) in fenced code blocks and inline
- [x] Detect plain bullet-list path format (`- layer/ → purpose`) via `PATH_LINE_RE`
- [x] Inject `STRUCTURE_INSTRUCTION` into system prompt when prompt is a folder-scan request
- [x] Fix `hasMemory` check — treat empty MEMORY.md skeleton as no memory (was always injecting)
- [x] Fix `toTitle` — strip leading markdown heading markers (`###`) from entry titles
- [x] Remove redundant commands: `add`, `supersede`, `consolidate`, `reset` alias
- [x] Add tests for all structure capture paths and context injection

## Next Iteration: Export & team sharing

### `/memory export` (mandatory)
- [ ] Implement `/memory export [--target claude|cursor|agents]` command
- [ ] Default target: `CLAUDE.md` (also covers Claude Code sessions outside pi)
- [ ] Other targets: `.cursor/rules`, `AGENTS.md`
- [ ] Generate a `## Project Memory` section from all topic files (decisions, patterns, preferences, gotchas)
- [ ] If target file exists: replace the `## Project Memory` section only, preserve the rest
- [ ] If target file does not exist: create it with the section
- [ ] Add `--dry-run` flag to preview without writing
- [ ] Add tests: export creates section, export replaces existing section, dry-run produces no write

### `/memory review` (staleness management)
- [ ] Implement `/memory review [--older-than <days>]` command (default: 90 days)
- [ ] List entries older than threshold and prompt user to confirm keep / edit / remove per entry
- [ ] Add tests for review filtering and interaction flow

### Tag support
- [ ] Add `--tag <tag>` flag to `/memory remember`
- [ ] Support `--tag` filter in `/memory list` and `/memory search`
- [ ] Store tags in entry metadata (already supported in `MemoryEntry.tags`)
