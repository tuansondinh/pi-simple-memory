import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { handleMemoryCommand } from "../extensions/pi-project-memory/commands/index.js";
import { loadEffectiveConfig } from "../extensions/pi-project-memory/config.js";
import { getMemoryDir, readTopicFile, writeEntry, clearAll, listEntries, findEntry, entryExists, editEntry, removeEntry } from "../extensions/pi-project-memory/storage/markdown.js";
import { injectIndex, rebuildIndex } from "../extensions/pi-project-memory/storage/memory-index.js";
import type { MemoryCommandDeps } from "../extensions/pi-project-memory/types.js";
import { createCommandContext, createState } from "./helpers.js";

describe("project memory commands", () => {
	it("adds, lists and clears memories", async () => {
		const root = join(tmpdir(), `project-memory-cmd-${Date.now()}`);
		const state = createState(root);
		state.config = await loadEffectiveConfig(root);
		const deps: MemoryCommandDeps = {
			state,
			storage: {
				getMemoryDir,
				readTopicFile,
				writeEntry,
				editEntry,
				removeEntry,
				listEntries,
				findEntry,
				entryExists,
				clearAll,
				rebuildIndex,
				injectIndex,
			},
		};
		const notify = vi.fn((_m: string, _l: "info" | "warning" | "error" | "success") => {});
		const ctx = createCommandContext(notify);

		await handleMemoryCommand("remember Use PostgreSQL", ctx, deps);
		expect((await listEntries(state.memoryDir!)).length).toBe(1);

		await handleMemoryCommand("list", ctx, deps);
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("decision"), "info");

		await handleMemoryCommand("clear", ctx, deps);
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("--yes"), "warning");

		await handleMemoryCommand("clear --yes", ctx, deps);
		expect((await listEntries(state.memoryDir!)).length).toBe(0);

		rmSync(root, { recursive: true, force: true });
	});
});
