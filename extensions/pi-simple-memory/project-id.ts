import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import type { ProjectIdentity } from "./types.js";

function toHash(input: string): string {
	return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

async function resolveCanonicalPath(inputPath: string): Promise<string> {
	try {
		return await realpath(inputPath);
	} catch {
		return inputPath;
	}
}

export async function resolveProjectIdentity(pi: ExtensionAPI, cwd: string): Promise<ProjectIdentity> {
	const gitRoot = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd });
	const projectRoot = gitRoot.code === 0 ? gitRoot.stdout.trim() || cwd : cwd;
	const projectCanonicalPath = await resolveCanonicalPath(projectRoot);
	const projectHash = toHash(projectCanonicalPath);

	return {
		projectRoot,
		projectCanonicalPath,
		projectHash,
	};
}
