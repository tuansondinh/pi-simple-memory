import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MemoryType } from "../types.js";
import { listEntries } from "./markdown.js";

const TOPIC_ORDER: MemoryType[] = ["decision", "pattern", "preference", "gotcha"];
const TOPIC_LABEL: Record<MemoryType, string> = {
	decision: "Decisions",
	pattern: "Patterns",
	preference: "Preferences",
	gotcha: "Gotchas",
};

function truncate(text: string, max = 120): string {
	const t = text.replace(/\s+/g, " ").trim();
	return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function enforceMaxLines(text: string, maxLines: number): string {
	const lines = text.split("\n");
	if (lines.length <= maxLines) return text;
	return `${lines.slice(0, maxLines - 1).join("\n")}\n- …`;
}

export async function rebuildIndex(dir: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	const sections: string[] = ["# Project Memory", "", `> Last updated: ${new Date().toISOString().slice(0, 10)}`, ""];

	for (const topic of TOPIC_ORDER) {
		const entries = (await listEntries(dir, topic)).slice(0, 40);
		sections.push(`## ${TOPIC_LABEL[topic]} (${entries.length})`);
		if (entries.length === 0) {
			sections.push("- (none)");
		} else {
			for (const entry of entries) {
				sections.push(`- ${truncate(entry.text || entry.title, 140)}`);
			}
		}
		sections.push("");
	}

	const content = enforceMaxLines(`${sections.join("\n").trim()}\n`, 200);
	await writeFile(path.join(dir, "MEMORY.md"), content, "utf8");
}

export async function injectIndex(dir: string): Promise<string> {
	const filePath = path.join(dir, "MEMORY.md");
	try {
		return await readFile(filePath, "utf8");
	} catch {
		await rebuildIndex(dir);
		try {
			return await readFile(filePath, "utf8");
		} catch {
			return "";
		}
	}
}
