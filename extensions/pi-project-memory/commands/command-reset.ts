import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import type { MemoryCommandDeps } from "../types.js";

export async function handleClear(rest: string, ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	if (!deps.state.memoryDir) return;
	if (rest.trim() !== "--yes") {
		const count = (await deps.storage.listEntries(deps.state.memoryDir)).length;
		ctx.ui.notify(`Clear would remove ${count} memories. Re-run with /memory clear --yes`, "warning");
		return;
	}
	await deps.storage.clearAll(deps.state.memoryDir);
	ctx.ui.notify("Cleared all project memory.", "info");
}
