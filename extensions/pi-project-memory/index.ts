import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { finalizePendingAutoCapture, preparePendingAutoCapture } from "./auto-capture.js";
import { getDefaultConfig, getGlobalConfigPath, getProjectConfigPath, loadEffectiveConfig, setEnabledInConfig } from "./config.js";
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
	});

	pi.on("before_agent_start", async (event, ctx) => {
		preparePendingAutoCapture(event.prompt, deps);
		return buildContextInjection(event, state);
	});

	pi.on("agent_end", async (event, ctx) => {
		await finalizePendingAutoCapture(event.messages, ctx, deps);
	});

	pi.registerCommand("memory", {
		description: "Manage project memory",
		handler: async (args, ctx) => {
			await handleMemoryCommand(args, ctx, deps);
		},
	});

}
