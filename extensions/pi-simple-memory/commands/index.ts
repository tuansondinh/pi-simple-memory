import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { handleAutoDream } from "./command-auto-dream.js";
import { handleEdit } from "./command-edit.js";
import { handleExtractOnNew } from "./command-extract-on-new.js";
import { handleList } from "./command-list.js";
import { handleRemember } from "./command-remember.js";
import { handleRemove } from "./command-remove.js";
import { handleClear } from "./command-reset.js";
import { handleSearch } from "./command-search.js";
import { handleStatus } from "./command-status.js";
import { handleToggle } from "./command-toggle.js";
import { splitSubcommand, usage } from "./command-utils.js";
import type { MemoryCommandDeps } from "../types.js";

const MUTATIONS = new Set(["remember", "edit", "remove", "clear"]);

export async function handleMemoryCommand(args: string, ctx: ExtensionCommandContext, deps: MemoryCommandDeps): Promise<void> {
	const trimmed = args.trim();
	if (!trimmed) {
		ctx.ui.notify(usage(), "info");
		return;
	}

	const { subcommand, rest } = splitSubcommand(trimmed);
	if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
		ctx.ui.notify(usage(), "info");
		return;
	}

	if (!deps.state.ready) {
		ctx.ui.notify("Project memory is initializing. Try again in a moment.", "warning");
		return;
	}

	if (!deps.state.config.enabled && MUTATIONS.has(subcommand)) {
		ctx.ui.notify("Project memory is disabled. Enable it to modify memories.", "warning");
		return;
	}

	if (subcommand === "status") return handleStatus(ctx, deps);
	if (subcommand === "enable") return handleToggle(rest, true, ctx, deps);
	if (subcommand === "disable") return handleToggle(rest, false, ctx, deps);
	if (subcommand === "remember") return handleRemember(rest, ctx, deps);
	if (subcommand === "list") return handleList(rest, ctx, deps);
	if (subcommand === "search") return handleSearch(rest, ctx, deps);
	if (subcommand === "edit") return handleEdit(rest, ctx, deps);
	if (subcommand === "remove") return handleRemove(rest, ctx, deps);
	if (subcommand === "clear") return handleClear(rest, ctx, deps);
	if (subcommand === "auto-dream") {
		const { subcommand: action, rest: scope } = splitSubcommand(rest);
		if (action === "enable" || action === "disable") return handleAutoDream(scope, action === "enable", ctx, deps);
		ctx.ui.notify("Usage: /memory auto-dream enable|disable --global|--project", "warning");
		return;
	}
	if (subcommand === "extract-on-new") {
		const { subcommand: action, rest: scope } = splitSubcommand(rest);
		if (action === "enable" || action === "disable") return handleExtractOnNew(scope, action === "enable", ctx, deps);
		ctx.ui.notify("Usage: /memory extract-on-new enable|disable --global|--project", "warning");
		return;
	}

	ctx.ui.notify(`Unknown subcommand '${subcommand}'.\n\n${usage()}`, "warning");
}
