import type { MemoryEntry, MemoryType } from "../types.js";

export function usage(): string {
	return [
		"Usage:",
		"  /memory help",
		"  /memory status",
		"  /memory remember <text> [--type decision|pattern|preference|gotcha]",
		"  /memory list [--type ...]",
		"  /memory search <query>",
		"  /memory edit <id> <text>",
		"  /memory remove <id>",
		"  /memory clear [--yes]",
		"  /memory enable --global|--project",
		"  /memory disable --global|--project",
		"  /memory auto-dream enable|disable --global|--project",
		"  /memory extract-on-new enable|disable --global|--project",
	].join("\n");
}

export function splitSubcommand(input: string): { subcommand: string; rest: string } {
	const firstSpace = input.indexOf(" ");
	if (firstSpace === -1) return { subcommand: input.trim(), rest: "" };
	return { subcommand: input.slice(0, firstSpace).trim(), rest: input.slice(firstSpace + 1).trim() };
}

export function splitIdAndText(input: string): { id: string; text: string } | null {
	const first = input.indexOf(" ");
	if (first < 0) return null;
	const id = input.slice(0, first).trim();
	const text = input.slice(first + 1).trim();
	if (!id || !text) return null;
	return { id, text };
}

export function parseToggleScope(input: string): "global" | "project" | null {
	if (input.trim() === "--global") return "global";
	if (input.trim() === "--project") return "project";
	return null;
}

export function parseTypeFlag(input: string): MemoryType | null {
	const match = input.match(/--type\s+(decision|pattern|preference|gotcha)/i);
	if (!match) return null;
	const value = match[1].toLowerCase();
	if (value === "pattern" || value === "preference" || value === "gotcha") return value;
	return "decision";
}

export function normalizeText(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function renderEntry(entry: MemoryEntry): string {
	const short = (entry.text || entry.title).replace(/\s+/g, " ").trim();
	const shortText = short.length > 120 ? `${short.slice(0, 119)}…` : short;
	return `${entry.id} | ${entry.type} | ${shortText}`;
}
