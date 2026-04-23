/**
 * pi-claude-memory — persistent file-based memory for pi agents.
 *
 * Memory files live at:
 *   ~/.pi-memory/projects/<name>-<hash>/memory/
 *
 * MEMORY.md is always loaded into context as a concise index.
 * Individual topic files hold the actual content.
 *
 * Hooks:
 *   session_start      → bootstrap memory dir + MEMORY.md
 *   before_agent_start → inject memory system prompt
 *
 * Commands:
 *   /memories          → list all saved memories
 *   /remember <text>   → ask agent to save something now
 *   /forget <topic>    → ask agent to find and remove a memory
 *   /dream             → ask agent to consolidate/prune memory inline
 *   /extract           → ask agent to extract memories from recent context
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { getMemoryDir, getMemoryEntrypoint, ensureMemoryDir } from './memory-paths.js';
import {
  MEMORY_FRONTMATTER_EXAMPLE,
  TYPES_SECTION,
  WHAT_NOT_TO_SAVE_SECTION,
  WHEN_TO_ACCESS_SECTION,
  TRUSTING_RECALL_SECTION,
} from './memory-types.js';
import { scanMemoryFiles } from './memory-scan.js';
import { memoryAge } from './memory-age.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_ENTRYPOINT_LINES = 200;
const MAX_ENTRYPOINT_BYTES = 25_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncateEntrypointContent(raw: string): { content: string; wasTruncated: boolean } {
  let wasTruncated = false;
  let content = raw.trim();
  const lines = content.split('\n');

  if (lines.length > MAX_ENTRYPOINT_LINES) {
    content = lines.slice(0, MAX_ENTRYPOINT_LINES).join('\n');
    wasTruncated = true;
  }

  if (Buffer.byteLength(content, 'utf-8') > MAX_ENTRYPOINT_BYTES) {
    let cutoff = content.length;
    while (Buffer.byteLength(content.slice(0, cutoff), 'utf-8') > MAX_ENTRYPOINT_BYTES) {
      const idx = content.lastIndexOf('\n', cutoff - 1);
      cutoff = idx > 0 ? idx : 0;
    }
    content = content.slice(0, cutoff);
    wasTruncated = true;
  }

  if (wasTruncated) {
    content += '\n\n> WARNING: MEMORY.md is too large. Only part was loaded. Keep index entries concise.';
  }

  return { content, wasTruncated };
}

function buildMemoryPrompt(memoryDir: string, entrypointContent: string, hasMemories: boolean): string {
  const sections: string[] = [];

  if (!hasMemories) {
    sections.push(`# Memory

You have a persistent, file-based memory system at \`${memoryDir}\`.
This directory already exists — write to it directly with the file write tool.

If the user explicitly asks you to remember something, save it immediately. If they ask you to forget, find and remove it.

To save a memory:
1. Write a markdown file to the memory directory with YAML frontmatter (name, description, type: user|feedback|project|reference)
2. Add a one-line pointer to MEMORY.md: \`- [Title](file.md) — one-line hook\`

Your MEMORY.md is currently empty.`);
    return sections.join('\n\n');
  }

  sections.push(`# Memory

You have a persistent, file-based memory system at \`${memoryDir}\`.
This directory already exists — write to it directly with the file write tool (do not run mkdir or check existence).

Build up this memory over time so future conversations have a complete picture of who the user is, how they'd like to collaborate, what to avoid or repeat, and the context behind their work.

If the user explicitly asks you to remember something, save it immediately. If they ask you to forget, find and remove it.`);

  sections.push(TYPES_SECTION.join('\n'));
  sections.push(WHAT_NOT_TO_SAVE_SECTION.join('\n'));

  sections.push(`## How to save memories

Saving a memory is a two-step process:

**Step 1** — write the memory to its own file (e.g., \`user_role.md\`, \`feedback_testing.md\`) using this frontmatter format:

${MEMORY_FRONTMATTER_EXAMPLE.join('\n')}

**Step 2** — add a pointer to that file in \`MEMORY.md\`. Each entry should be one line, under ~150 characters: \`- [Title](file.md) — one-line hook\`. Never write memory content directly into \`MEMORY.md\`.

- \`MEMORY.md\` is always loaded into your context — lines after ${MAX_ENTRYPOINT_LINES} will be truncated
- Keep name, description, and type fields up-to-date
- Organize semantically, not chronologically
- Update or remove stale memories
- Check for existing memories before writing duplicates`);

  sections.push(WHEN_TO_ACCESS_SECTION.join('\n'));
  sections.push(TRUSTING_RECALL_SECTION.join('\n'));

  const body =
    entrypointContent.trim() ||
    'Your MEMORY.md is currently empty. When you save new memories, they will appear here.';
  sections.push(`## MEMORY.md\n\n${body}`);

  return sections.join('\n\n');
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function memoryExtension(pi: ExtensionAPI) {
  let memoryCwd = '';
  let memoryDir = '';

  // ── session_start: bootstrap ──────────────────────────────────────────────
  pi.on('session_start', async (_event, ctx) => {
    memoryCwd = ctx.cwd;
    memoryDir = getMemoryDir(memoryCwd);
    ensureMemoryDir(memoryCwd);

    const entrypoint = getMemoryEntrypoint(memoryCwd);
    if (!existsSync(entrypoint)) {
      writeFileSync(entrypoint, '', 'utf-8');
    }
  });

  // ── before_agent_start: inject memory prompt ──────────────────────────────
  pi.on('before_agent_start', async (event) => {
    if (!memoryCwd) return;

    const entrypoint = getMemoryEntrypoint(memoryCwd);
    let entrypointContent = '';
    try {
      entrypointContent = readFileSync(entrypoint, 'utf-8');
    } catch {
      // deleted between session_start and now — no-op
    }

    if (entrypointContent.trim()) {
      const { content } = truncateEntrypointContent(entrypointContent);
      entrypointContent = content;
    }

    const prompt = buildMemoryPrompt(memoryDir, entrypointContent, !!entrypointContent.trim());

    return {
      systemPrompt: event.systemPrompt + '\n\n' + prompt,
    };
  });

  // ── /memories — list all saved memories ──────────────────────────────────
  pi.registerCommand('memories', {
    description: 'List all saved memories',
    handler: async (_args, ctx) => {
      if (!memoryCwd) {
        ctx.ui.notify('No memory directory initialized', 'warning');
        return;
      }
      const memories = scanMemoryFiles(memoryDir);
      if (memories.length === 0) {
        pi.sendUserMessage("No memories saved yet. I'll start building memory as we work together.");
        return;
      }
      const lines = memories.map((m) => {
        const age = memoryAge(m.mtimeMs);
        const type = m.type ? `[${m.type}] ` : '';
        const desc = m.description ? ` — ${m.description}` : '';
        return `- ${type}**${m.filename}** (${age})${desc}`;
      });
      pi.sendUserMessage(`Here are your saved memories:\n\n${lines.join('\n')}`);
    },
  });

  // ── /remember <text> — save a memory immediately ─────────────────────────
  pi.registerCommand('remember', {
    description: 'Save a memory immediately',
    handler: async (args) => {
      if (!memoryCwd) return;
      const text = args.trim();
      if (!text) return;
      pi.sendUserMessage(`Please save this to memory: ${text}`);
    },
  });

  // ── /forget <topic> — remove a memory ────────────────────────────────────
  pi.registerCommand('forget', {
    description: 'Find and remove a memory by topic',
    handler: async (args) => {
      if (!memoryCwd) return;
      const topic = args.trim();
      if (!topic) return;
      pi.sendUserMessage(`Please find and remove any memories about: ${topic}`);
    },
  });

  // ── /dream — consolidate memory inline ───────────────────────────────────
  pi.registerCommand('dream', {
    description: 'Consolidate and prune memories (runs inline in this session)',
    handler: async (_args, ctx) => {
      if (!memoryCwd) {
        ctx.ui.notify('No memory directory initialized', 'warning');
        return;
      }
      pi.sendUserMessage(`Please perform a memory consolidation pass on \`${memoryDir}\`.

Goals:
- List the memory directory and read MEMORY.md
- Skim all topic files; prefer improving or merging over creating new ones
- Merge duplicate or overlapping memories into the best single file
- Remove contradicted, stale, or low-signal memories
- Repair or remove broken MEMORY.md links
- Keep MEMORY.md as a concise index (one line per entry, ~150 chars max)
- Only modify files inside \`${memoryDir}\`
- Use bash only for read-only inspection

When done, give a short summary of what you consolidated, updated, pruned, or left unchanged.`);
    },
  });

  // ── /extract — extract memories from recent context ───────────────────────
  pi.registerCommand('extract', {
    description: 'Extract durable memories from this conversation (runs inline)',
    handler: async (_args, ctx) => {
      if (!memoryCwd) {
        ctx.ui.notify('No memory directory initialized', 'warning');
        return;
      }
      const memories = scanMemoryFiles(memoryDir);
      const existingList =
        memories.length > 0
          ? memories.map((m) => `- ${m.filename}${m.description ? `: ${m.description}` : ''}`).join('\n')
          : 'None yet.';

      pi.sendUserMessage(`Please review our conversation so far and extract any durable memories worth keeping.

Memory directory: \`${memoryDir}\`

Rules:
- Save ONLY: user preferences, feedback/corrections, project context, external references
- Do NOT save: raw code, file paths, git history, one-off fixes, ephemeral task details
- Check existing memories below — update rather than duplicate
- Use frontmatter: name, description, type (user|feedback|project|reference)
- After writing topic files, update MEMORY.md with one-line index entries
- Be selective — only save things useful in FUTURE conversations
- If nothing is worth saving, do nothing and say so

Existing memories:
${existingList}`);
    },
  });
}
