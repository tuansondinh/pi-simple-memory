import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { parseTypeFlag } from "./command-utils.js";
import type { MemoryCommandDeps, MemoryType } from "../types.js";

export async function handleRemember(rest: string, ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	if (!deps.state.memoryDir) {
		ctx.ui.notify("Memory storage is not ready yet.", "warning");
		return;
	}
	const type: MemoryType = parseTypeFlag(rest) ?? "decision";
	const text = rest.replace(/--type\s+(decision|pattern|preference|gotcha)/i, "").trim();
	if (!text) {
		ctx.ui.notify("Usage: /memory remember <text> [--type decision|pattern|preference|gotcha]", "warning");
		return;
	}
	if (await deps.storage.entryExists(deps.state.memoryDir, text)) {
		ctx.ui.notify("Similar memory already exists; skipping duplicate.", "warning");
		return;
	}
	const entry = await deps.storage.writeEntry(deps.state.memoryDir, type, {
		text,
		category: type === "decision" ? "policy" : type === "pattern" ? "quality" : "workflow",
		source: "user",
	});
	ctx.ui.notify(`Added memory ${entry.id} (${entry.type})`, "info");
}
