# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-01

### ⚠ BREAKING CHANGES

- Renamed extension from **pi-decision-memory** to **pi-project-memory**.
- Primary command is now **`/memory`** (`/decision` alias removed).
- Storage moved from append-only JSONL to markdown files in:
  - `.pi/project-memory/MEMORY.md`
  - `.pi/project-memory/decisions.md`
  - `.pi/project-memory/patterns.md`
  - `.pi/project-memory/preferences.md`
  - `.pi/project-memory/gotchas.md`
- Configuration paths changed to:
  - `~/.pi/agent/project-memory.config.json`
  - `<project>/.pi/project-memory.config.json`
- Test suite migrated from `decision-memory-*` to `project-memory-*`.

### Added

- New markdown storage engine with typed memory entries.
- Regenerated memory index (`MEMORY.md`) and context injection.
- New command surface:
  - `/memory add|remember|list|search|edit|remove|supersede|clear|status|enable|disable|consolidate`
- Auto-capture v2 with rule/llm/hybrid classifier support and confirmation/silent thresholds.

### Changed

- Package metadata updated to `pi-project-memory@1.0.0`.
- Root README rewritten for v2 usage and install flow.

### Removed

- Legacy `extensions/pi-decision-memory/*` implementation.
- Legacy `tests/decision-memory-*.test.ts` suite.
