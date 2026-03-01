import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { editEntry, findEntry, getMemoryDir, listEntries, removeEntry, writeEntry } from "../extensions/pi-project-memory/storage/markdown.js";

describe("project memory markdown storage", () => {
	it("writes, edits and removes entries by id", async () => {
		const root = join(tmpdir(), `project-memory-storage-${Date.now()}`);
		const dir = getMemoryDir(root);

		const created = await writeEntry(dir, "decision", {
			text: "Use PostgreSQL for primary database",
			category: "tooling",
			source: "user",
		});
		expect(created.id.length).toBeGreaterThanOrEqual(4);

		const found = await findEntry(dir, created.id);
		expect(found?.text).toContain("PostgreSQL");

		const edited = await editEntry(dir, created.id, "Use PostgreSQL 16 for primary database");
		expect(edited?.text).toContain("PostgreSQL 16");

		const entries = await listEntries(dir, "decision");
		expect(entries).toHaveLength(1);
		expect(entries[0].id).toBe(created.id);

		const removed = await removeEntry(dir, created.id);
		expect(removed).toBe(true);
		expect(await findEntry(dir, created.id)).toBeNull();

		rmSync(root, { recursive: true, force: true });
	});
});
