# pi-simple-memory

Simple persistent file-based memory for [pi](https://github.com/badlogic/pi-mono) agents.

## Install

```bash
pi install npm:pi-simple-memory
```

## How it works

Memories are markdown files with YAML frontmatter stored at:
```
~/.pi-memory/projects/<name>-<hash>/memory/
```

`MEMORY.md` is a concise index that gets injected into the system prompt once per session. The agent reads topic files on demand via the `read` tool.

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
| `/memory:list` | List all saved memories |
| `/memory:remember <text>` | Ask agent to save something now |
| `/memory:forget <topic>` | Ask agent to find and remove a memory |
| `/memory:dream` | Consolidate and prune memories inline |
| `/memory:extract` | Extract durable memories from this conversation |

## Memory file format

```markdown
---
name: my memory
description: one-line description used to decide relevance
type: user
---

Memory content here.
```
