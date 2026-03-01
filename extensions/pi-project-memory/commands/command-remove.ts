import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import type { MemoryCommandDeps } from "../types.js";

export async function handleRemove(rest: string, ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	if (!deps.state.memoryDir) return;
	const id = rest.trim();
	if (!id) {
		ctx.ui.notify("Usage: /memory remove <id>", "warning");
		return;
	}
	const removed = await deps.storage.removeEntry(deps.state.memoryDir, id);
	if (!removed) {
		ctx.ui.notify(`Memory ${id} not found.`, "warning");
		return;
	}
	ctx.ui.notify(`Removed memory ${id}`, "info");
}
