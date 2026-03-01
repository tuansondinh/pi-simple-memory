import type { BeforeAgentStartEvent } from "@mariozechner/pi-coding-agent";

import { injectIndex } from "./storage/memory-index.js";
import type { MemoryState } from "./types.js";

const STRUCTURE_SCAN_RE =
	/\b(scan|analyze|analyse|check|look\s+at|review)\b.{0,60}\b(folder|feature|structure|directory)\b|\b(folder|feature|structure|directory)\b.{0,60}\b(scan|analyze|analyse|check|review)\b/i;

const STRUCTURE_INSTRUCTION = `When analyzing a project folder or feature structure, include a dedicated template section that lists each layer as a bullet point in this exact format:
\`\`\`
- layer/ → purpose
- layer/ → purpose
\`\`\`
This allows the structure to be saved as a reusable project memory pattern.`;

export async function buildContextInjection(
	event: BeforeAgentStartEvent,
	state: MemoryState,
): Promise<{ systemPrompt: string } | undefined> {
	if (!state.ready || !state.config.enabled) return undefined;
	if (!state.memoryDir) return undefined;

	const memoryText = await injectIndex(state.memoryDir);
	const hasMemory = /^- (?!\(none\))/m.test(memoryText);
	const isStructureScan = STRUCTURE_SCAN_RE.test(event.prompt);

	if (!hasMemory && !isStructureScan) return undefined;

	let systemPrompt = event.systemPrompt;

	if (hasMemory) {
		const lines = memoryText.split("\n").slice(0, state.config.context.maxLines);
		let compact = lines.join("\n");
		if (compact.length > state.config.context.maxSectionChars) {
			compact = `${compact.slice(0, state.config.context.maxSectionChars - 1)}…`;
		}
		systemPrompt = `${systemPrompt}\n\n# Project memory\n\n${compact}`;
	}

	if (isStructureScan) {
		systemPrompt = `${systemPrompt}\n\n# Output instructions\n\n${STRUCTURE_INSTRUCTION}`;
	}

	return { systemPrompt };
}
