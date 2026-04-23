import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import type { MemoryCommandDeps } from "../types.js";
import { parseToggleScope } from "./command-utils.js";

export async function handleAutoDream(
	rest: string,
	enabled: boolean,
	ctx: ExtensionCommandContext,
	deps: MemoryCommandDeps,
): Promise<void> {
	const scope = parseToggleScope(rest);
	if (!scope) {
		ctx.ui.notify("Usage: /memory auto-dream enable|disable --global|--project", "warning");
		return;
	}

	const ok =
		scope === "global"
			? await deps.setAutoDreamGlobal?.(enabled)
			: await deps.setAutoDreamProject?.(enabled);

	if (!ok) {
		ctx.ui.notify("Could not update config. Try after session initialization.", "warning");
		return;
	}

	ctx.ui.notify(`Auto-dream ${enabled ? "enabled" : "disabled"} (${scope}).`, "info");
}
