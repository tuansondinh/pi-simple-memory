# pi-simple-memory

Persistent file-based memory for [pi](https://github.com/badlogic/pi-mono) agents. Memories survive across sessions and are automatically injected into context when relevant.

## Install

```bash
pi install npm:pi-simple-memory
```

## How it works

### Storage

Memories are stored as markdown files with YAML frontmatter under:

```
~/.pi-memory/projects/<project-name>-<hash>/memory/
  decisions.md
  patterns.md
  preferences.md
  gotchas.md
  MEMORY.md        ← index, injected into every session
```

Each project gets its own isolated memory dir, identified by git root path.

### System prompt injection

At the start of every agent turn, the extension injects a `# Project memory` section into the system prompt containing a compact index of all saved memories (`MEMORY.md`). The agent can read individual topic files on demand via the `read` tool for full detail.

This means the agent always knows what has been remembered — without you having to repeat context every session.

### Auto-capture

After each agent turn, the extension scans your input for lines that look like durable facts worth saving:

- **Rule classifier** — regex patterns that match decisions (`use`, `adopt`, `do not`, `avoid`), patterns (`always`, `consistently`), preferences (`prefer`, `i like`), and gotchas (`watch out`, `be careful`, `footgun`)
- **LLM classifier** — optional second pass using the active model to score ambiguous candidates
- **Hybrid mode** (default) — rule classifier runs first; LLM is consulted when confidence is borderline

High-confidence matches (≥ 0.85) are saved silently. Lower-confidence matches (≥ 0.65) are surfaced for review via a select dialog. You can confirm, skip, or dismiss.

The extension also detects folder/file tree structures in agent responses and auto-saves them as `pattern` memories so project layout is remembered.

### Extract on new session

When you start a new session with `/new`, the extension asks whether you want the agent to extract and save important memories from the current conversation before switching. If you confirm, the switch is cancelled and the agent is prompted to review the conversation and call `remember` for anything worth keeping. You can then `/new` again once done.

This can be disabled per-project or globally:

```
/memory extract-on-new disable --global
/memory extract-on-new disable --project
```

### The `remember` tool

The agent can save memories mid-turn without user intervention via the `remember` tool:

```
remember(text, type, category?, title?)
```

The agent uses this when it notices something worth keeping — an architecture decision you made, a convention it should follow, a preference you expressed. It won't save transient task instructions or one-off requests.

## Commands

| Command | Description |
|---|---|
| `/memory status` | Show config and memory count |
| `/memory list [--type ...]` | List saved memories |
| `/memory search <query>` | Search memories by text |
| `/memory remember <text> [--type ...]` | Manually save a memory |
| `/memory edit <id> <text>` | Edit an existing memory |
| `/memory remove <id>` | Remove a memory |
| `/memory clear [--yes]` | Delete all memories |
| `/memory enable --global\|--project` | Enable memory |
| `/memory disable --global\|--project` | Disable memory |
| `/memory extract-on-new enable\|disable --global\|--project` | Toggle extract prompt on `/new` |

## Memory types

| Type | When used |
|---|---|
| `decision` | Architecture choices, tooling decisions, policies |
| `pattern` | Recurring conventions, folder structures, workflows |
| `preference` | User or team preferences, style rules |
| `gotcha` | Non-obvious pitfalls, caveats, traps |

## Memory file format

```markdown
---
id: d-001
title: Use ESM modules
type: decision
category: tooling
addedAt: 2026-04-23T10:00:00Z
---

Use ESM modules throughout. No CommonJS.
```

## Configuration

Config files live at `~/.pi/agent/project-memory.config.json` (global) and `.pi/project-memory.config.json` (project). Project config overrides global.

```json
{
  "enabled": true,
  "extractOnNew": { "enabled": true },
  "autoCapture": {
    "enabled": true,
    "confirm": true,
    "maxPerTurn": 3,
    "silentThreshold": 0.85,
    "classifier": {
      "mode": "hybrid",
      "confidenceThreshold": 0.65
    }
  },
  "context": {
    "maxSectionChars": 2200,
    "maxLines": 200
  }
}
```
