import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { parseToggleScope } from "./command-utils.js";
import type { MemoryCommandDeps } from "../types.js";

export async function handleToggle(
	rest: string,
	enabled: boolean,
	ctx: ExtensionCommandContext,
	deps: MemoryCommandDeps,
): Promise<void> {
	const scope = parseToggleScope(rest);
	if (!scope) {
		ctx.ui.notify("Usage: /memory enable|disable --global|--project", "warning");
		return;
	}

	const ok =
		scope === "global"
			? await deps.setEnabledGlobal?.(enabled)
			: await deps.setEnabledProject?.(enabled);
	if (!ok) {
		ctx.ui.notify("Could not update config yet. Try after session initialization.", "warning");
		return;
	}

	ctx.ui.notify(`${enabled ? "Enabled" : "Disabled"} project memory (${scope}).`, "info");
}
