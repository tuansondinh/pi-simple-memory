# pi-simple-memory (fork)

Markdown-based project memory extension for Pi.

> **Fork of [zeflq/pi-project-memory](https://github.com/zeflq/pi-project-memory)** — all credit to the original author. This fork adds an agent-callable `remember` tool so the LLM can save memories mid-turn, plus a roadmap toward session-end auto-extract and `/dream` consolidation (inspired by LSD's memory system).

## Fork changes

- **`remember` tool** — LLM can now call `remember({ text, type, category?, title? })` to save a memory without user intervention. Upstream auto-capture only mines user prompts; this closes the gap for memories the agent discovers mid-task.
- Recall remains tool-free: `MEMORY.md` manifest is already injected into system prompt each turn, and full memory bodies are read via the built-in `read` tool.

## Install

```bash
pi install https://github.com/zeflq/pi-project-memory
```

## Storage

All memory is stored in project-local markdown files:

```
.pi/project-memory/
├── MEMORY.md
├── decisions.md
├── patterns.md
├── preferences.md
└── gotchas.md
```

`MEMORY.md` is rebuilt automatically after writes and injected into context.

## Commands

```text
/memory help
/memory status
/memory remember <text> [--type decision|pattern|preference|gotcha]
/memory list [--type ...]
/memory search <query>
/memory edit <id> <text>
/memory remove <id>
/memory clear [--yes]
/memory enable --global|--project
/memory disable --global|--project
```

## Config

Global: `~/.pi/agent/project-memory.config.json`

Project: `<project>/.pi/project-memory.config.json`

```json
{
  "enabled": true,
  "context": {
    "maxSectionChars": 2200,
    "maxLines": 200
  },
  "autoCapture": {
    "enabled": true,
    "confirm": true,
    "maxPerTurn": 3,
    "silentThreshold": 0.85,
    "classifier": {
      "mode": "hybrid",
      "confidenceThreshold": 0.65
    }
  }
}
```

## Auto-capture

- Captures broad candidate lines from user prompt (before run)
- Classifies with `rule` / `llm` / `hybrid`
- Saves silently for high-confidence (`>= silentThreshold`)
- Asks user confirmation for mid-confidence
- Skips on failed/aborted runs

The LLM classifier uses the model and API key from your current pi session — no separate configuration needed. If no model is available, it falls back to the rule-based classifier automatically.

## Dev

```bash
npm run test:project-memory
npm run check
```
