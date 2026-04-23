import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";

// Tool parameter schema. Extracted so `Static<typeof REMEMBER_PARAMS>` can type `params`
// manually — current pi-coding-agent 0.55.3 has a dep-tree mismatch (imports TSchema from
// "typebox" in its d.ts but transitively re-exports @sinclair/typebox types via pi-ai),
// which breaks inference on `registerTool({ parameters })`. Cast is the cleanest workaround.
const REMEMBER_PARAMS = Type.Object({
	text: Type.String({
		description: "One-line memory, <200 chars. Specific and actionable.",
	}),
	type: Type.Union(
		[
			Type.Literal("decision"),
			Type.Literal("pattern"),
			Type.Literal("preference"),
			Type.Literal("gotcha"),
		],
		{
			description:
				"decision=architecture/tooling choice; pattern=recurring convention; " +
				"preference=user style rule; gotcha=non-obvious pitfall.",
		},
	),
	category: Type.Optional(
		Type.Union(
			[
				Type.Literal("architecture"),
				Type.Literal("tooling"),
				Type.Literal("data"),
				Type.Literal("policy"),
				Type.Literal("quality"),
				Type.Literal("workflow"),
			],
			{ description: "Coarse category. Default: workflow." },
		),
	),
	title: Type.Optional(
		Type.String({ description: "Optional short title. Derived from text if omitted." }),
	),
});
type RememberParams = Static<typeof REMEMBER_PARAMS>;

import { finalizePendingAutoCapture, preparePendingAutoCapture } from "./auto-capture.js";
import { DREAM_PROMPT, incrementSessions, loadDreamState, markDreamed, saveDreamState, shouldDream } from "./dream-scheduler.js";
import { getDefaultConfig, getGlobalConfigPath, getProjectConfigPath, loadEffectiveConfig, setEnabledInConfig, setNestedFlagInConfig } from "./config.js";
import { buildContextInjection } from "./context.js";
import { handleMemoryCommand } from "./commands/index.js";
import { resolveProjectIdentity } from "./project-id.js";
import { clearAll, entryExists, findEntry, getMemoryDir, listEntries, readTopicFile, removeEntry, writeEntry, editEntry } from "./storage/markdown.js";
import { injectIndex, rebuildIndex } from "./storage/memory-index.js";
import type { MemoryCommandDeps, MemoryState } from "./types.js";

function initialState(): MemoryState {
	return {
		ready: false,
		config: getDefaultConfig(),
		identity: null,
		memoryDir: null,
		pendingAutoCaptureCandidates: [],
		dreamDue: false,
		dreamPrompted: false,
	};
}

export default function projectMemoryExtension(pi: ExtensionAPI): void {
	const state = initialState();

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
		setEnabledGlobal: async (enabled: boolean) => {
			const projectRoot = state.identity?.projectRoot;
			if (!projectRoot) return false;
			await setEnabledInConfig(getGlobalConfigPath(), enabled);
			state.config = await loadEffectiveConfig(projectRoot);
			return true;
		},
		setEnabledProject: async (enabled: boolean) => {
			const projectRoot = state.identity?.projectRoot;
			if (!projectRoot) return false;
			await setEnabledInConfig(getProjectConfigPath(projectRoot), enabled);
			state.config = await loadEffectiveConfig(projectRoot);
			return true;
		},
		setAutoDreamGlobal: async (enabled: boolean) => {
			const projectRoot = state.identity?.projectRoot;
			if (!projectRoot) return false;
			await setNestedFlagInConfig(getGlobalConfigPath(), "autoDream", enabled);
			state.config = await loadEffectiveConfig(projectRoot);
			return true;
		},
		setAutoDreamProject: async (enabled: boolean) => {
			const projectRoot = state.identity?.projectRoot;
			if (!projectRoot) return false;
			await setNestedFlagInConfig(getProjectConfigPath(projectRoot), "autoDream", enabled);
			state.config = await loadEffectiveConfig(projectRoot);
			return true;
		},
		setExtractOnNewGlobal: async (enabled: boolean) => {
			const projectRoot = state.identity?.projectRoot;
			if (!projectRoot) return false;
			await setNestedFlagInConfig(getGlobalConfigPath(), "extractOnNew", enabled);
			state.config = await loadEffectiveConfig(projectRoot);
			return true;
		},
		setExtractOnNewProject: async (enabled: boolean) => {
			const projectRoot = state.identity?.projectRoot;
			if (!projectRoot) return false;
			await setNestedFlagInConfig(getProjectConfigPath(projectRoot), "extractOnNew", enabled);
			state.config = await loadEffectiveConfig(projectRoot);
			return true;
		},
	};

	pi.on("session_start", async (_event, ctx) => {
		const identity = await resolveProjectIdentity(pi, ctx.cwd);
		const config = await loadEffectiveConfig(identity.projectRoot);
		const memoryDir = getMemoryDir(identity.projectRoot);
		await rebuildIndex(memoryDir);
		state.identity = identity;
		state.config = config;
		state.memoryDir = memoryDir;
		state.ready = true;

		if (config.enabled && config.autoDream.enabled) {
			let dreamState = await loadDreamState(memoryDir);
			dreamState = incrementSessions(dreamState);
			state.dreamDue = shouldDream(dreamState);
			await saveDreamState(memoryDir, dreamState);
		}
	});

	pi.on("before_agent_start", async (event, ctx) => {
		preparePendingAutoCapture(event.prompt, deps);

		// Prompt for dream consolidation once per session when threshold is hit.
		if (state.dreamDue && !state.dreamPrompted && state.memoryDir) {
			state.dreamPrompted = true;
			const entries = await deps.storage.listEntries(state.memoryDir);
			if (entries.length > 0) {
				const wants = await ctx.ui.confirm(
					"Consolidate memories?",
					`You have ${entries.length} memories and it's been a while since last consolidation. ` +
						"Consolidate now? The agent will merge duplicates and clean up stale entries.",
					{ timeout: 20_000 },
				);
				if (wants && state.memoryDir) {
					const updated = markDreamed();
					await saveDreamState(state.memoryDir, updated);
					state.dreamDue = false;
					pi.sendUserMessage(DREAM_PROMPT, { deliverAs: "steer" });
				}
			}
		}

		return buildContextInjection(event, state);
	});

	pi.on("agent_end", async (event, ctx) => {
		await finalizePendingAutoCapture(event.messages, ctx, deps);
	});

	// Ask user to extract memories before starting a new session.
	pi.on("session_before_switch", async (event, ctx) => {
		if (event.reason !== "new") return;
		if (!state.ready || !state.config.enabled || !state.config.extractOnNew.enabled) return;

		const wantsExtract = await ctx.ui.confirm(
			"Save memories before starting fresh?",
			"Do you want the agent to extract and save important memories from this session before opening a new one?",
			{ timeout: 15_000 },
		);

		if (!wantsExtract) return; // proceed with switch

		// Cancel the switch and trigger extraction; user can /new again after.
		pi.sendUserMessage(
			"Before we start fresh: please review this conversation and use the `remember` tool to save any " +
			"important decisions, patterns, preferences, or gotchas worth keeping for future sessions. " +
			"When done, let me know — I'll start the new session.",
		);

		return { cancel: true };
	});

	// On exit: no agent turn is possible, so just remind the user.
	pi.on("session_shutdown", async (_event, ctx) => {
		if (!state.ready || !state.config.enabled) return;
		const entries = state.memoryDir ? await deps.storage.listEntries(state.memoryDir) : [];
		if (entries.length === 0) {
			ctx.ui.notify("Tip: use /memory remember <text> to save memories for future sessions.", "info");
		}
	});

	pi.registerCommand("memory", {
		description: "Manage project memory",
		handler: async (args, ctx) => {
			await handleMemoryCommand(args, ctx, deps);
		},
	});

	// Tool — lets the agent save memories mid-turn without user intervention.
	// MEMORY.md manifest is already injected into system prompt each turn, so
	// recall is free via the built-in read tool; only save needs a dedicated tool.
	pi.registerTool({
		name: "remember",
		label: "Remember",
		description:
			"Save a project memory for future sessions. Use when you learn a durable fact " +
			"about this project: an architectural decision, a recurring pattern, a user preference, " +
			"or a gotcha worth flagging. Skip raw code, ephemeral task state, or anything already in git/README.",
		parameters: REMEMBER_PARAMS as unknown as Parameters<typeof pi.registerTool>[0]["parameters"],
		async execute(_toolCallId, rawParams, _signal, _onUpdate, _ctx) {
			const params = rawParams as RememberParams;
			if (!state.ready || !state.config.enabled || !state.memoryDir) {
				return {
					content: [{ type: "text", text: "Memory extension not ready; nothing saved." }],
					details: { saved: false, reason: "not-ready" },
				};
			}

			const text = params.text.trim();
			if (!text) {
				return {
					content: [{ type: "text", text: "Empty memory text; nothing saved." }],
					details: { saved: false, reason: "empty" },
				};
			}

			if (await entryExists(state.memoryDir, text)) {
				return {
					content: [{ type: "text", text: `Duplicate memory, skipped: "${text}"` }],
					details: { saved: false, reason: "duplicate" },
				};
			}

			const saved = await writeEntry(state.memoryDir, params.type, {
				text,
				title: params.title,
				category: params.category ?? "workflow",
				source: "agent-tool",
			});

			return {
				content: [
					{
						type: "text",
						text: `Saved [${saved.type}/${saved.category}] ${saved.id}: ${saved.title}`,
					},
				],
				details: {
					saved: true,
					id: saved.id,
					type: saved.type,
					category: saved.category,
					title: saved.title,
				},
			};
		},
	});
}
