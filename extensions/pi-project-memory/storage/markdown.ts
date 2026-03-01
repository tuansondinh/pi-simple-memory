import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MemoryEntry, MemoryType } from "../types.js";

const TOPIC_FILES: Record<MemoryType, string> = {
	decision: "decisions.md",
	pattern: "patterns.md",
	preference: "preferences.md",
	gotcha: "gotchas.md",
};

const TOPIC_TITLES: Record<MemoryType, string> = {
	decision: "Decisions",
	pattern: "Patterns",
	preference: "Preferences",
	gotcha: "Gotchas",
};

function normalizeText(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hash(input: string): string {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
	}
	return Math.abs(h >>> 0).toString(16);
}

function parseType(value: string): MemoryType {
	if (value === "pattern" || value === "preference" || value === "gotcha") return value;
	return "decision";
}

function parseEntryBlock(block: string): MemoryEntry | null {
	const heading = block.match(/^##\s+(.+?)\s+<!--\s*id:([a-z0-9]+)\s*-->\s*$/m);
	if (!heading) return null;
	const title = heading[1].trim();
	const id = heading[2].trim();

	const metaLineMatch = block.match(/^_Added:\s*.+_$/m);
	if (!metaLineMatch) return null;
	const metaLine = metaLineMatch[0].slice(1, -1);
	const parts = metaLine.split("|").map((part) => part.trim());
	const fields = new Map<string, string>();
	for (const part of parts) {
		const idx = part.indexOf(":");
		if (idx < 0) continue;
		fields.set(part.slice(0, idx).trim().toLowerCase(), part.slice(idx + 1).trim());
	}

	const addedAt = fields.get("added");
	const typeRaw = fields.get("type");
	const categoryRaw = fields.get("category");
	if (!addedAt || !typeRaw || !categoryRaw) return null;

	const confidenceRaw = fields.get("confidence");
	const source = fields.get("source");
	const tagsRaw = fields.get("tags");

	const bodyStart = block.indexOf(metaLineMatch[0]) + metaLineMatch[0].length;
	const text = block.slice(bodyStart).trim();
	return {
		id,
		title,
		text,
		type: parseType(typeRaw),
		category: categoryRaw as MemoryEntry["category"],
		confidence: confidenceRaw ? Number.parseFloat(confidenceRaw) : undefined,
		source,
		addedAt,
		tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
	};
}

function serializeEntry(entry: MemoryEntry): string {
	const tagsPart = entry.tags && entry.tags.length > 0 ? ` | Tags: ${entry.tags.join(", ")}` : "";
	const confidencePart = typeof entry.confidence === "number" ? ` | Confidence: ${entry.confidence.toFixed(2)}` : "";
	const sourcePart = entry.source ? ` | Source: ${entry.source}` : "";

	return [
		`## ${entry.title} <!-- id:${entry.id} -->`,
		`_Added: ${entry.addedAt} | Type: ${entry.type} | Category: ${entry.category}${confidencePart}${sourcePart}${tagsPart}_`,
		"",
		entry.text.trim(),
		"",
		"---",
		"",
	].join("\n");
}

async function readText(filePath: string): Promise<string> {
	try {
		return await readFile(filePath, "utf8");
	} catch {
		return "";
	}
}

function topicFilePath(dir: string, type: MemoryType): string {
	return path.join(dir, TOPIC_FILES[type]);
}

function headingFor(type: MemoryType): string {
	return `# ${TOPIC_TITLES[type]}\n\n`;
}

function toTitle(text: string): string {
	const compact = text.replace(/\s+/g, " ").trim().replace(/^#+\s*/, "");
	return compact.slice(0, 80) || "memory";
}

export function getMemoryDir(projectRoot: string): string {
	return path.join(projectRoot, ".pi", "project-memory");
}

export async function readTopicFile(dir: string, type: MemoryType): Promise<MemoryEntry[]> {
	const filePath = topicFilePath(dir, type);
	const content = await readText(filePath);
	if (!content.trim()) return [];
	const blocks = content.match(/##[\s\S]*?(?=\n---\n|$)/g) ?? [];
	return blocks
		.map((block) => parseEntryBlock(`${block.trim()}\n`))
		.filter((entry): entry is MemoryEntry => entry !== null);
}

export async function listEntries(dir: string, topic?: MemoryType): Promise<MemoryEntry[]> {
	if (topic) return readTopicFile(dir, topic);
	const entries = await Promise.all((Object.keys(TOPIC_FILES) as MemoryType[]).map((t) => readTopicFile(dir, t)));
	return entries.flat().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function findEntry(dir: string, id: string): Promise<MemoryEntry | null> {
	const entries = await listEntries(dir);
	return entries.find((entry) => entry.id === id) ?? null;
}

export async function entryExists(dir: string, text: string): Promise<boolean> {
	const normalized = normalizeText(text);
	const entries = await listEntries(dir);
	return entries.some((entry) => normalizeText(entry.text) === normalized || normalizeText(entry.title) === normalized);
}

async function nextId(dir: string, text: string, addedAt: string, type: MemoryType): Promise<string> {
	const base = hash(`${text}|${addedAt}`);
	const existingIds = new Set((await readTopicFile(dir, type)).map((entry) => entry.id));
	for (const size of [4, 6, 8, 10]) {
		const candidate = base.slice(0, size);
		if (!existingIds.has(candidate)) return candidate;
	}
	return `${base.slice(0, 10)}${Math.floor(Math.random() * 9999)}`;
}

export async function writeEntry(
	dir: string,
	topic: MemoryType,
	entry: Omit<MemoryEntry, "id" | "addedAt" | "title" | "type"> & { title?: string },
): Promise<MemoryEntry> {
	await mkdir(dir, { recursive: true });
	const addedAt = new Date().toISOString();
	const id = await nextId(dir, entry.text, addedAt, topic);
	const full: MemoryEntry = {
		id,
		title: toTitle(entry.title?.trim() || entry.text),
		text: entry.text.trim(),
		type: topic,
		category: entry.category,
		confidence: entry.confidence,
		source: entry.source,
		addedAt,
		tags: entry.tags,
	};
	const filePath = topicFilePath(dir, topic);
	const current = await readText(filePath);
	const next = `${current || headingFor(topic)}${serializeEntry(full)}`;
	await writeFile(filePath, next, "utf8");
	const { rebuildIndex } = await import("./memory-index.js");
	await rebuildIndex(dir);
	return full;
}

export async function editEntry(dir: string, id: string, newText: string): Promise<MemoryEntry | null> {
	for (const topic of Object.keys(TOPIC_FILES) as MemoryType[]) {
		const entries = await readTopicFile(dir, topic);
		const index = entries.findIndex((e) => e.id === id);
		if (index < 0) continue;
		entries[index].text = newText.trim();
		entries[index].title = toTitle(newText);
		const content = `${headingFor(topic)}${entries.map(serializeEntry).join("")}`;
		await writeFile(topicFilePath(dir, topic), content, "utf8");
		const { rebuildIndex } = await import("./memory-index.js");
		await rebuildIndex(dir);
		return entries[index];
	}
	return null;
}

export async function removeEntry(dir: string, id: string): Promise<boolean> {
	for (const topic of Object.keys(TOPIC_FILES) as MemoryType[]) {
		const entries = await readTopicFile(dir, topic);
		const filtered = entries.filter((e) => e.id !== id);
		if (filtered.length === entries.length) continue;
		const content = filtered.length > 0 ? `${headingFor(topic)}${filtered.map(serializeEntry).join("")}` : headingFor(topic);
		await writeFile(topicFilePath(dir, topic), content, "utf8");
		const { rebuildIndex } = await import("./memory-index.js");
		await rebuildIndex(dir);
		return true;
	}
	return false;
}

export async function clearAll(dir: string): Promise<void> {
	await rm(dir, { recursive: true, force: true });
}
