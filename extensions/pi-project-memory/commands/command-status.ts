import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import type { MemoryCommandDeps } from "../types.js";

export async function handleStatus(ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	const enabled = deps.state.config.enabled ? "enabled" : "disabled";
	const project = deps.state.identity?.projectHash ?? "unknown";
	const count = deps.state.memoryDir ? (await deps.storage.listEntries(deps.state.memoryDir)).length : 0;
	ctx.ui.notify(`Project memory: ${enabled} | project=${project} | memories=${count}`, "info");
}
