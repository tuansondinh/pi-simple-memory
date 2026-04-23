import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AutoCaptureConfig, MemoryConfig } from "./types.js";

type PartialMemoryConfig = {
	enabled?: boolean;
	context?: Partial<MemoryConfig["context"]>;
	autoCapture?: {
		enabled?: boolean;
		confirm?: boolean;
		maxPerTurn?: number;
		silentThreshold?: number;
		classifier?: Partial<AutoCaptureConfig["classifier"]>;
	};
	extractOnNew?: { enabled?: boolean };
};

const DEFAULT_CONFIG: MemoryConfig = {
	enabled: true,
	context: {
		maxSectionChars: 2200,
		maxLines: 200,
	},
	autoCapture: {
		enabled: true,
		confirm: true,
		maxPerTurn: 3,
		silentThreshold: 0.85,
		classifier: {
			mode: "hybrid",
			confidenceThreshold: 0.65,
		},
	},
	extractOnNew: { enabled: true },
};

export function getDefaultConfig(): MemoryConfig {
	return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as MemoryConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function parsePartialConfig(raw: unknown): PartialMemoryConfig {
	if (!isRecord(raw)) return {};
	const autoCaptureRaw = isRecord(raw.autoCapture) ? raw.autoCapture : {};
	const classifierRaw = isRecord(autoCaptureRaw.classifier) ? autoCaptureRaw.classifier : {};
	const extractOnNewRaw = isRecord(raw.extractOnNew) ? raw.extractOnNew : {};

	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : undefined,
		context: {
			maxSectionChars:
				typeof raw.context === "object" && raw.context !== null && typeof (raw.context as Record<string, unknown>).maxSectionChars === "number"
					? clamp(Math.floor((raw.context as Record<string, number>).maxSectionChars), 400, 8000)
					: undefined,
			maxLines:
				typeof raw.context === "object" && raw.context !== null && typeof (raw.context as Record<string, unknown>).maxLines === "number"
					? clamp(Math.floor((raw.context as Record<string, number>).maxLines), 20, 400)
					: undefined,
		},
		autoCapture: {
			enabled: typeof autoCaptureRaw.enabled === "boolean" ? autoCaptureRaw.enabled : undefined,
			confirm: typeof autoCaptureRaw.confirm === "boolean" ? autoCaptureRaw.confirm : undefined,
			maxPerTurn: typeof autoCaptureRaw.maxPerTurn === "number" ? clamp(Math.floor(autoCaptureRaw.maxPerTurn), 1, 10) : undefined,
			silentThreshold:
				typeof autoCaptureRaw.silentThreshold === "number"
					? clamp(autoCaptureRaw.silentThreshold, 0, 1)
					: undefined,
			classifier: {
				mode:
					classifierRaw.mode === "rule" || classifierRaw.mode === "llm" || classifierRaw.mode === "hybrid"
						? classifierRaw.mode
						: undefined,
				confidenceThreshold:
					typeof classifierRaw.confidenceThreshold === "number"
						? clamp(classifierRaw.confidenceThreshold, 0, 1)
						: undefined,
			},
		},
		extractOnNew: {
			enabled: typeof extractOnNewRaw.enabled === "boolean" ? extractOnNewRaw.enabled : undefined,
		},
	};
}

function mergeConfig(base: MemoryConfig, override: PartialMemoryConfig): MemoryConfig {
	return {
		enabled: override.enabled ?? base.enabled,
		context: {
			maxSectionChars: override.context?.maxSectionChars ?? base.context.maxSectionChars,
			maxLines: override.context?.maxLines ?? base.context.maxLines,
		},
		autoCapture: {
			enabled: override.autoCapture?.enabled ?? base.autoCapture.enabled,
			confirm: override.autoCapture?.confirm ?? base.autoCapture.confirm,
			maxPerTurn: override.autoCapture?.maxPerTurn ?? base.autoCapture.maxPerTurn,
			silentThreshold: override.autoCapture?.silentThreshold ?? base.autoCapture.silentThreshold,
			classifier: {
				mode: override.autoCapture?.classifier?.mode ?? base.autoCapture.classifier.mode,
				confidenceThreshold:
					override.autoCapture?.classifier?.confidenceThreshold ?? base.autoCapture.classifier.confidenceThreshold,
			},
		},
		extractOnNew: { enabled: override.extractOnNew?.enabled ?? base.extractOnNew.enabled },
	};
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function loadRaw(filePath: string): Promise<Record<string, unknown>> {
	if (!(await fileExists(filePath))) return {};
	try {
		const content = await readFile(filePath, "utf8");
		const parsed = JSON.parse(content) as unknown;
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

export function getGlobalConfigPath(): string {
	return path.join(os.homedir(), ".pi", "agent", "project-memory.config.json");
}

export function getProjectConfigPath(projectRoot: string): string {
	return path.join(projectRoot, ".pi", "project-memory.config.json");
}

export async function setEnabledInConfig(configPath: string, enabled: boolean): Promise<void> {
	const raw = await loadRaw(configPath);
	raw.enabled = enabled;
	await mkdir(path.dirname(configPath), { recursive: true });
	await writeFile(configPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

export async function setNestedFlagInConfig(
	configPath: string,
	key: "autoDream" | "extractOnNew",
	enabled: boolean,
): Promise<void> {
	const raw = await loadRaw(configPath);
	const existing = isRecord(raw[key]) ? (raw[key] as Record<string, unknown>) : {};
	raw[key] = { ...existing, enabled };
	await mkdir(path.dirname(configPath), { recursive: true });
	await writeFile(configPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

export async function loadEffectiveConfig(projectRoot: string): Promise<MemoryConfig> {
	const globalRaw = await loadRaw(getGlobalConfigPath());
	const projectRaw = await loadRaw(getProjectConfigPath(projectRoot));

	const globalConfig = mergeConfig(getDefaultConfig(), parsePartialConfig(globalRaw));
	if (!globalConfig.enabled) return globalConfig;
	return mergeConfig(globalConfig, parsePartialConfig(projectRaw));
}
