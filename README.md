# pi-project-memory

Markdown-based project memory extension for Pi.

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

## Dev

```bash
npm run test:project-memory
npm run check
```
