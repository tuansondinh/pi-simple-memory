import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import type { MemoryCommandDeps } from "../types.js";
import { parseToggleScope } from "./command-utils.js";

export async function handleExtractOnNew(
	rest: string,
	enabled: boolean,
	ctx: ExtensionCommandContext,
	deps: MemoryCommandDeps,
): Promise<void> {
	const scope = parseToggleScope(rest);
	if (!scope) {
		ctx.ui.notify("Usage: /memory extract-on-new enable|disable --global|--project", "warning");
		return;
	}

	const ok =
		scope === "global"
			? await deps.setExtractOnNewGlobal?.(enabled)
			: await deps.setExtractOnNewProject?.(enabled);

	if (!ok) {
		ctx.ui.notify("Could not update config. Try after session initialization.", "warning");
		return;
	}

	ctx.ui.notify(`Extract-on-new ${enabled ? "enabled" : "disabled"} (${scope}).`, "info");
}
