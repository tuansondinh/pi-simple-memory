import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import { classifyMemoryWithLLM } from "./classifier-llm.js";
import { classifyMemoryRule, type MemoryClassification } from "./classifier.js";
import type { MemoryCommandDeps } from "./types.js";

const TREE_LINE_RE = /(?:├──|└──|│)/;
const PATH_LINE_RE = /^(?:\s+)?(?:\.\/)?[\w.-]+\/|^(?:\s+)?[-*]\s+[\w.-]+\//;

function isPathStructureBlock(text: string): boolean {
	const lines = text.split("\n").filter((l) => l.trim().length > 0);
	if (lines.length < 3) return false;
	const pathCount = lines.filter((l) => PATH_LINE_RE.test(l)).length;
	return pathCount / lines.length >= 0.6;
}

function extractCandidates(prompt: string, max: number): string[] {
	return prompt
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.filter((line) => !line.endsWith("?"))
		.slice(0, max);
}

function getLastAssistantMessage(messages: AgentMessage[]): AgentMessage | undefined {
	return messages.filter((m) => m.role === "assistant").at(-1);
}

function extractAssistantText(message: AgentMessage | undefined): string {
	if (!message) return "";
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (typeof part === "string") return part;
			if (part && typeof part === "object" && "text" in part) {
				const text = (part as { text?: unknown }).text;
				return typeof text === "string" ? text : "";
			}
			return "";
		})
		.join("\n")
		.trim();
}

function extractTreeBlocks(text: string): string[] {
	const blocks = new Set<string>();
	if (!text.trim()) return [];

	for (const match of text.matchAll(/```[\w-]*\n([\s\S]*?)```/g)) {
		const body = (match[1] ?? "").trim();
		if (TREE_LINE_RE.test(body) || isPathStructureBlock(body)) {
			blocks.add(body);
		}
	}

	if (blocks.size > 0) return [...blocks];

	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i += 1) {
		if (!TREE_LINE_RE.test(lines[i]) && !PATH_LINE_RE.test(lines[i])) continue;
		let start = i;
		if (i > 0 && lines[i - 1].trim() && !TREE_LINE_RE.test(lines[i - 1])) {
			start = i - 1;
		}
		let end = i + 1;
		while (end < lines.length && (TREE_LINE_RE.test(lines[end]) || PATH_LINE_RE.test(lines[end]) || lines[end].trim() === "")) {
			end += 1;
		}
		const block = lines.slice(start, end).join("\n").trim();
		if (TREE_LINE_RE.test(block) || isPathStructureBlock(block)) {
			blocks.add(block);
		}
		i = end - 1;
	}

	return [...blocks];
}

function extractStructureCandidates(messages: AgentMessage[]): MemoryClassification[] {
	const assistantText = extractAssistantText(getLastAssistantMessage(messages));
	const blocks = extractTreeBlocks(assistantText);
	return blocks.map((block) => ({
		isMemory: true,
		memoryType: "pattern",
		normalizedText: block,
		confidence: 0.82,
		category: "architecture",
		reason: "assistant discovered folder/file structure",
		source: "rule",
	}));
}

function skipAfterRun(messages: AgentMessage[]): boolean {
	const lastAssistant = getLastAssistantMessage(messages) as (AgentMessage & { stopReason?: string }) | undefined;
	return lastAssistant?.stopReason === "error" || lastAssistant?.stopReason === "aborted";
}

function mapMemoryType(category: MemoryClassification["category"]): MemoryClassification["memoryType"] {
	if (category === "quality") return "pattern";
	if (category === "workflow") return "preference";
	return "decision";
}

async function classify(
	candidate: string,
	ctx: ExtensionContext,
	deps: MemoryCommandDeps,
): Promise<MemoryClassification | null> {
	const mode = deps.state.config.autoCapture.classifier.mode;
	const rule = classifyMemoryRule(candidate);
	if (!rule.isMemory && rule.confidence <= 0.05) return rule;
	if (mode === "rule") return rule;

	const llm = await classifyMemoryWithLLM(candidate, ctx);
	if (mode === "llm") return llm ?? rule;
	if (!llm) return rule;
	return llm.confidence >= rule.confidence ? llm : rule;
}

export function preparePendingAutoCapture(prompt: string, deps: MemoryCommandDeps): void {
	deps.state.pendingAutoCaptureCandidates = [];
	if (!deps.state.ready || !deps.state.config.enabled || !deps.state.config.autoCapture.enabled) return;
	deps.state.pendingAutoCaptureCandidates = extractCandidates(prompt, deps.state.config.autoCapture.maxPerTurn);
}

async function selectCandidates(
	classified: MemoryClassification[],
	ctx: ExtensionContext,
	deps: MemoryCommandDeps,
): Promise<MemoryClassification[]> {
	if (!ctx.hasUI || !deps.state.config.autoCapture.confirm) return classified;
	const silent = classified.filter((c) => c.confidence >= deps.state.config.autoCapture.silentThreshold);
	const review = classified.filter(
		(c) => c.confidence >= deps.state.config.autoCapture.classifier.confidenceThreshold && c.confidence < deps.state.config.autoCapture.silentThreshold,
	);
	const selected = [...silent];

	if (review.length === 0) return selected;

	try {
		const remaining = [...review];
		while (remaining.length > 0) {
			const labels = remaining.map((c) => `${c.normalizedText.replace(/\s*\n\s*/g, " ↵ ")} (${c.memoryType}, ${Math.round(c.confidence * 100)}%)`);
			const choice = await ctx.ui.select("Save memories", [...labels, "Done"]);
			if (!choice || choice === "Done") break;
			const idx = labels.indexOf(choice);
			if (idx < 0) break;
			selected.push(remaining[idx]);
			remaining.splice(idx, 1);
		}
	} catch {
		for (const candidate of review) {
			const ok = await ctx.ui.confirm("Save memory", `${candidate.normalizedText}\n\nType: ${candidate.memoryType}`);
			if (ok) selected.push(candidate);
		}
	}
	return selected;
}

export async function finalizePendingAutoCapture(
	messages: AgentMessage[],
	ctx: ExtensionContext,
	deps: MemoryCommandDeps,
): Promise<void> {
	if (!deps.state.ready || !deps.state.config.enabled || !deps.state.config.autoCapture.enabled) {
		deps.state.pendingAutoCaptureCandidates = [];
		return;
	}
	if (!deps.state.memoryDir) return;
	if (skipAfterRun(messages)) {
		deps.state.pendingAutoCaptureCandidates = [];
		return;
	}

	const threshold = deps.state.config.autoCapture.classifier.confidenceThreshold;
	const pending = [...deps.state.pendingAutoCaptureCandidates];
	deps.state.pendingAutoCaptureCandidates = [];

	const classified: MemoryClassification[] = [];
	for (const candidate of pending) {
		if (await deps.storage.entryExists(deps.state.memoryDir, candidate)) continue;
		const result = await classify(candidate, ctx, deps);
		if (!result || !result.isMemory) continue;
		if (result.confidence < threshold) continue;
		classified.push({ ...result, memoryType: result.memoryType ?? mapMemoryType(result.category) });
	}

	for (const structure of extractStructureCandidates(messages)) {
		if (structure.confidence < threshold) continue;
		if (await deps.storage.entryExists(deps.state.memoryDir, structure.normalizedText)) continue;
		classified.push(structure);
	}

	const deduped = Array.from(new Map(classified.map((item) => [item.normalizedText, item])).values());
	const selected = await selectCandidates(deduped, ctx, deps);
	for (const item of selected) {
		const topic = item.memoryType || mapMemoryType(item.category);
		const entry = await deps.storage.writeEntry(deps.state.memoryDir, topic, {
			text: item.normalizedText,
			category: item.category,
			confidence: item.confidence,
			source: item.source === "llm" ? "auto-llm-classifier" : "auto-rule-classifier",
		});
		if (ctx.hasUI) {
			ctx.ui.notify(`Auto-saved memory ${entry.id} (${entry.type})`, "info");
		}
	}
}
