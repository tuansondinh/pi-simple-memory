## [0.1.0] - 2026-04-23

### Features
- Persistent file-based memory ported from LSD memory extension
- Memories stored at `~/.pi-memory/projects/<name>-<hash>/memory/`
- MEMORY.md index injected into system prompt once per session
- Four memory types: user, feedback, project, reference
- `/memory:list` — show all saved memories (no agent trigger)
- `/memory:remember <text>` — ask agent to save something now
- `/memory:forget <topic>` — ask agent to find and remove a memory
- `/memory:dream` — inline memory consolidation/pruning
- `/memory:extract` — inline memory extraction from conversation
- Namespaced commands (`memory:`) to avoid collisions with other extensions
