import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { rebuildIndex } from "../extensions/pi-project-memory/storage/memory-index.js";
import { getMemoryDir, writeEntry } from "../extensions/pi-project-memory/storage/markdown.js";

describe("project memory index", () => {
	it("rebuilds MEMORY.md from topic files", async () => {
		const root = join(tmpdir(), `project-memory-index-${Date.now()}`);
		const dir = getMemoryDir(root);
		await writeEntry(dir, "decision", { text: "Use Clean Architecture", category: "architecture" });
		await writeEntry(dir, "preference", { text: "Prefer snake_case for files", category: "workflow" });
		await rebuildIndex(dir);

		const memory = readFileSync(join(dir, "MEMORY.md"), "utf8");
		expect(memory).toContain("## Decisions");
		expect(memory).toContain("Use Clean Architecture");
		expect(memory).toContain("## Preferences");

		rmSync(root, { recursive: true, force: true });
	});
});
