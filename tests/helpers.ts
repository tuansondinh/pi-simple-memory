import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { getDefaultConfig } from "../extensions/pi-simple-memory/config.js";
import { getMemoryDir } from "../extensions/pi-simple-memory/storage/markdown.js";
import type { MemoryState } from "../extensions/pi-simple-memory/types.js";

export function createState(projectRoot = "/tmp/project"): MemoryState {
	return {
		ready: true,
		config: getDefaultConfig(),
		identity: {
			projectRoot,
			projectCanonicalPath: projectRoot,
			projectHash: "p123",
		},
		memoryDir: getMemoryDir(projectRoot),
		pendingAutoCaptureCandidates: [],
	};
}

export function createCommandContext(
	notify: (msg: string, level: "info" | "warning" | "error" | "success") => void,
): ExtensionCommandContext {
	return {
		hasUI: true,
		ui: { notify },
	} as unknown as ExtensionCommandContext;
}
