import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { normalizeText, renderEntry } from "./command-utils.js";
import type { MemoryCommandDeps } from "../types.js";

export async function handleSearch(rest: string, ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	if (!deps.state.memoryDir) return;
	const query = rest.trim();
	if (!query) {
		ctx.ui.notify("Usage: /memory search <query>", "warning");
		return;
	}
	const needle = normalizeText(query);
	const entries = await deps.storage.listEntries(deps.state.memoryDir);
	const matches = entries.filter((entry) => {
		const hay = normalizeText(`${entry.title} ${entry.text} ${entry.category} ${entry.type}`);
		return hay.includes(needle);
	});
	if (matches.length === 0) {
		ctx.ui.notify("No matching memories found.", "info");
		return;
	}
	ctx.ui.notify(matches.map(renderEntry).join("\n"), "info");
}
