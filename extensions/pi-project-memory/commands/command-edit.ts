import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { splitIdAndText } from "./command-utils.js";
import type { MemoryCommandDeps } from "../types.js";

export async function handleEdit(rest: string, ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	if (!deps.state.memoryDir) return;
	const parsed = splitIdAndText(rest);
	if (!parsed) {
		ctx.ui.notify("Usage: /memory edit <id> <text>", "warning");
		return;
	}

	const updated = await deps.storage.editEntry(deps.state.memoryDir, parsed.id, parsed.text);
	if (!updated) {
		ctx.ui.notify(`Memory ${parsed.id} not found.`, "warning");
		return;
	}
	ctx.ui.notify(`Edited memory ${parsed.id}`, "info");
}
