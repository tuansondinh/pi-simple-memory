import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { parseTypeFlag, renderEntry } from "./command-utils.js";
import type { MemoryCommandDeps } from "../types.js";

export async function handleList(rest: string, ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	if (!deps.state.memoryDir) return;
	const type = parseTypeFlag(rest) ?? undefined;
	const entries = await deps.storage.listEntries(deps.state.memoryDir, type);
	if (entries.length === 0) {
		ctx.ui.notify("No memory entries found.", "info");
		return;
	}
	ctx.ui.notify(entries.map(renderEntry).join("\n"), "info");
}
