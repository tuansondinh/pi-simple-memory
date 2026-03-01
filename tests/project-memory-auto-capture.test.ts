import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { finalizePendingAutoCapture, preparePendingAutoCapture } from "../extensions/pi-project-memory/auto-capture.js";
import { loadEffectiveConfig } from "../extensions/pi-project-memory/config.js";
import { clearAll, editEntry, entryExists, findEntry, getMemoryDir, listEntries, readTopicFile, removeEntry, writeEntry } from "../extensions/pi-project-memory/storage/markdown.js";
import { injectIndex, rebuildIndex } from "../extensions/pi-project-memory/storage/memory-index.js";
import type { MemoryCommandDeps } from "../extensions/pi-project-memory/types.js";
import { createState } from "./helpers.js";

function depsFor(root: string): Promise<MemoryCommandDeps> {
	const state = createState(root);
	return loadEffectiveConfig(root).then((cfg) => {
		state.config = cfg;
		return {
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
	});
}

function testCtx() {
	return {
		hasUI: true,
		model: undefined,
		modelRegistry: undefined,
		ui: { select: vi.fn(), confirm: vi.fn(), notify: vi.fn() },
	} as never;
}

describe("project memory auto-capture", () => {
	it("captures durable memory lines after run", async () => {
		const root = join(tmpdir(), `project-memory-ac-${Date.now()}`);
		const deps = await depsFor(root);
		deps.state.config.autoCapture.confirm = false;
		preparePendingAutoCapture("in this proejct we will use clean architecture", deps);
		expect(deps.state.pendingAutoCaptureCandidates.length).toBe(1);

		await finalizePendingAutoCapture([{ role: "assistant", content: [{ type: "text", text: "done" }] }] as never, testCtx(), deps);

		expect((await listEntries(deps.state.memoryDir!)).length).toBe(1);
		rmSync(root, { recursive: true, force: true });
	});

	it("does not save task-like scan request as memory", async () => {
		const root = join(tmpdir(), `project-memory-ac-task-${Date.now()}`);
		const deps = await depsFor(root);
		deps.state.config.autoCapture.confirm = false;
		preparePendingAutoCapture("can you scan the features folder and tell me if we should keep it like that", deps);

		await finalizePendingAutoCapture([{ role: "assistant", content: [{ type: "text", text: "I checked it." }] }] as never, testCtx(), deps);

		expect((await listEntries(deps.state.memoryDir!)).length).toBe(0);
		rmSync(root, { recursive: true, force: true });
	});

	it("extracts and saves folder tree from assistant response as architecture pattern", async () => {
		const root = join(tmpdir(), `project-memory-ac-tree-${Date.now()}`);
		const deps = await depsFor(root);
		deps.state.config.autoCapture.confirm = false;
		preparePendingAutoCapture("can you scan the features folder and tell me if we should keep it like that", deps);

		await finalizePendingAutoCapture(
			[
				{
					role: "assistant",
					content: [
						{
							type: "text",
							text: "```\nfeatures/\n├── auth/\n│   ├── components/\n│   └── hooks/\n└── billing/\n```",
						},
					],
				},
			] as never,
			testCtx(),
			deps,
		);

		const entries = await listEntries(deps.state.memoryDir!);
		expect(entries.length).toBe(1);
		expect(entries[0].type).toBe("pattern");
		expect(entries[0].category).toBe("architecture");
		expect(entries[0].text).toContain("├── auth/");
		rmSync(root, { recursive: true, force: true });
	});

	it("extracts bullet-list folder template from assistant response as architecture pattern", async () => {
		const root = join(tmpdir(), `project-memory-ac-bullet-${Date.now()}`);
		const deps = await depsFor(root);
		deps.state.config.autoCapture.confirm = false;
		preparePendingAutoCapture("can scan the features folder and tell me if we should keep it like that for next features", deps);

		const agentText = [
			"Recommended template for new features",
			"",
			"- domain/ → entities, value objects, repository interfaces (no Prisma imports)",
			"- application/usecases/ → orchestration, depends only on domain interfaces",
			"- infrastructure/ → Prisma repos, external API clients, email adapters",
			"- presentation/ → thin controllers/routes only",
			"- bootstrap/ → DI wiring only",
		].join("\n");

		await finalizePendingAutoCapture(
			[{ role: "assistant", content: [{ type: "text", text: agentText }] }] as never,
			testCtx(),
			deps,
		);

		const entries = await listEntries(deps.state.memoryDir!);
		expect(entries.length).toBe(1);
		expect(entries[0].type).toBe("pattern");
		expect(entries[0].category).toBe("architecture");
		expect(entries[0].text).toContain("domain/");
		expect(entries[0].text).toContain("application/usecases/");
		rmSync(root, { recursive: true, force: true });
	});
});
