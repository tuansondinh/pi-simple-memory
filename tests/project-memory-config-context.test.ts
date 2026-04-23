import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadEffectiveConfig } from "../extensions/pi-simple-memory/config.js";
import { buildContextInjection } from "../extensions/pi-simple-memory/context.js";
import { rebuildIndex } from "../extensions/pi-simple-memory/storage/memory-index.js";
import { getMemoryDir, writeEntry } from "../extensions/pi-simple-memory/storage/markdown.js";
import { createState } from "./helpers.js";

describe("project memory config and context", () => {
	it("merges global/project config with project precedence", async () => {
		const root = join(tmpdir(), `project-memory-config-${Date.now()}`);
		const home = join(root, "home");
		const projectRoot = join(root, "project");
		mkdirSync(join(home, ".pi", "agent"), { recursive: true });
		mkdirSync(join(projectRoot, ".pi"), { recursive: true });

		writeFileSync(
			join(home, ".pi", "agent", "project-memory.config.json"),
			JSON.stringify({ autoCapture: { classifier: { mode: "llm", confidenceThreshold: 0.9 } } }),
		);
		writeFileSync(
			join(projectRoot, ".pi", "project-memory.config.json"),
			JSON.stringify({ autoCapture: { classifier: { mode: "rule", confidenceThreshold: 0.5 } } }),
		);

		const prevHome = process.env.HOME;
		process.env.HOME = home;
		const cfg = await loadEffectiveConfig(projectRoot);
		process.env.HOME = prevHome;

		expect(cfg.autoCapture.classifier.mode).toBe("rule");
		expect(cfg.autoCapture.classifier.confidenceThreshold).toBe(0.5);
		rmSync(root, { recursive: true, force: true });
	});

	it("injects MEMORY.md into system prompt", async () => {
		const root = join(tmpdir(), `project-memory-context-${Date.now()}`);
		const dir = getMemoryDir(root);
		await writeEntry(dir, "decision", { text: "Use PostgreSQL", category: "tooling" });
		await rebuildIndex(dir);

		const state = createState(root);
		const result = await buildContextInjection(
			{ type: "before_agent_start", prompt: "x", images: [], systemPrompt: "base" },
			state,
		);
		expect(result?.systemPrompt).toContain("# Project memory");
		expect(result?.systemPrompt).toContain("Use PostgreSQL");

		rmSync(root, { recursive: true, force: true });
	});

	it("injects structure instruction when prompt is a folder scan request", async () => {
		const root = join(tmpdir(), `project-memory-context-scan-${Date.now()}`);
		const state = createState(root);
		const result = await buildContextInjection(
			{ type: "before_agent_start", prompt: "can you scan the features folder and tell me if we should keep it like that", images: [], systemPrompt: "base" },
			state,
		);
		expect(result?.systemPrompt).toContain("# Output instructions");
		expect(result?.systemPrompt).toContain("- layer/ → purpose");
		rmSync(root, { recursive: true, force: true });
	});

	it("does not inject structure instruction for unrelated prompts", async () => {
		const root = join(tmpdir(), `project-memory-context-noop-${Date.now()}`);
		const state = createState(root);
		const result = await buildContextInjection(
			{ type: "before_agent_start", prompt: "fix the login bug", images: [], systemPrompt: "base" },
			state,
		);
		expect(result).toBeUndefined();
		rmSync(root, { recursive: true, force: true });
	});
});
