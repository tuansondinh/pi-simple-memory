# pi-simple-memory

Simple persistent file-based memory for [pi](https://github.com/badlogic/pi-mono) agents. Ported from the LSD memory extension.

## Install

```bash
pi install npm:pi-simple-memory
```

## How it works

Memories are markdown files with YAML frontmatter stored at:

```
~/.pi-memory/projects/<project-name>-<hash>/memory/
  MEMORY.md        ← index, injected into every session
  <topic>.md       ← individual memory files
```

Each project gets its own isolated memory dir, keyed by the git root path.

### System prompt injection

At the start of every agent turn, the extension injects a `# Memory` section into the system prompt containing the full `MEMORY.md` index (up to 200 lines / 25 KB). The agent reads individual topic files on demand with the `read` tool.

The agent writes and updates memory files directly using the built-in `write` and `edit` tools — no dedicated "remember" tool. Each memory is a markdown file with frontmatter, and gets a one-line pointer in `MEMORY.md`.

## Memory types

| Type | When to save |
|---|---|
| `user` | Preferences, conventions, workflow habits |
| `feedback` | Corrections or praise about agent behaviour |
| `project` | Architecture decisions, repo conventions, domain knowledge |
| `reference` | Useful facts, links, documentation pointers |

## Commands

| Command | Description |
|---|---|
| `/memory:list` | List all saved memory files |
| `/memory:remember <text>` | Ask the agent to save something now |
| `/memory:forget <topic>` | Ask the agent to find and remove a memory |
| `/memory:dream` | Ask the agent to consolidate and prune memories inline |
| `/memory:extract` | Ask the agent to extract durable memories from this conversation |

All commands except `list` work by sending a user message to the agent, which then performs the action with its normal file tools.

## Memory file format

```markdown
---
name: My memory
description: one-line description used to decide relevance in future conversations
type: user
---

Memory content here. For feedback/project types, structure as:
rule/fact, then **Why:** and **How to apply:** lines.
```

## MEMORY.md format

```markdown
- [My memory](my-memory.md) — one-line hook
- [Another thing](another-thing.md) — another hook
```

Keep entries concise — the whole file is truncated to 200 lines / 25 KB when injected.
