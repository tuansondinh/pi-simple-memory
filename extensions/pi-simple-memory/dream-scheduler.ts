import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DreamSchedulerState {
	lastDreamAt: string | null; // ISO 8601 date string
	sessionsSinceLastDream: number;
}

const DREAM_STATE_FILE = "dream-state.json";
const MAX_SESSIONS = 10;
const MAX_DAYS = 1;

function stateFilePath(memoryDir: string): string {
	// Store alongside the memory dir, one level up
	return path.join(path.dirname(memoryDir), DREAM_STATE_FILE);
}

export async function loadDreamState(memoryDir: string): Promise<DreamSchedulerState> {
	try {
		const raw = await readFile(stateFilePath(memoryDir), "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed === "object" && parsed !== null) {
			const p = parsed as Record<string, unknown>;
			return {
				lastDreamAt: typeof p.lastDreamAt === "string" ? p.lastDreamAt : null,
				sessionsSinceLastDream: typeof p.sessionsSinceLastDream === "number" ? p.sessionsSinceLastDream : 0,
			};
		}
	} catch {
		// File missing or invalid — start fresh
	}
	return { lastDreamAt: null, sessionsSinceLastDream: 0 };
}

export async function saveDreamState(memoryDir: string, state: DreamSchedulerState): Promise<void> {
	const file = stateFilePath(memoryDir);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function shouldDream(state: DreamSchedulerState): boolean {
	if (state.sessionsSinceLastDream >= MAX_SESSIONS) return true;
	if (state.lastDreamAt !== null) {
		const lastDream = new Date(state.lastDreamAt);
		const daysSince = (Date.now() - lastDream.getTime()) / (1000 * 60 * 60 * 24);
		if (daysSince >= MAX_DAYS) return true;
	}
	return false;
}

export function markDreamed(): DreamSchedulerState {
	return {
		lastDreamAt: new Date().toISOString(),
		sessionsSinceLastDream: 0,
	};
}

export function incrementSessions(state: DreamSchedulerState): DreamSchedulerState {
	return { ...state, sessionsSinceLastDream: state.sessionsSinceLastDream + 1 };
}

export const DREAM_PROMPT =
	"Please consolidate my project memories. Use the `read` tool to review each memory file " +
	"(decisions.md, patterns.md, preferences.md, gotchas.md) in my memory directory, then:\n" +
	"1. Merge duplicate or overlapping entries into single, cleaner ones using `remember`.\n" +
	"2. Flag entries that are stale or no longer relevant (list their IDs).\n" +
	"3. Rewrite vague entries to be more specific and actionable using `remember`.\n\n" +
	"For each entry you replace or make redundant, call `/memory remove <id>` so only the " +
	"refined version remains. Summarize what was consolidated when done.";
