import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

export type MemoryType = "decision" | "pattern" | "preference" | "gotcha";
export type MemoryCategory = "architecture" | "tooling" | "data" | "policy" | "quality" | "workflow";

export interface MemoryEntry {
	id: string;
	title: string;
	text: string;
	type: MemoryType;
	category: MemoryCategory;
	confidence?: number;
	source?: string;
	addedAt: string;
	tags?: string[];
}

export interface ProjectIdentity {
	projectRoot: string;
	projectCanonicalPath: string;
	projectHash: string;
}

export interface MemoryContextConfig {
	maxSectionChars: number;
	maxLines: number;
}

export interface AutoCaptureClassifierConfig {
	mode: "rule" | "llm" | "hybrid";
	confidenceThreshold: number;
}

export interface AutoCaptureConfig {
	enabled: boolean;
	confirm: boolean;
	maxPerTurn: number;
	silentThreshold: number;
	classifier: AutoCaptureClassifierConfig;
}

export interface MemoryConfig {
	enabled: boolean;
	context: MemoryContextConfig;
	autoCapture: AutoCaptureConfig;
}

export interface StorageAPI {
	getMemoryDir(projectRoot: string): string;
	readTopicFile(dir: string, topic: MemoryType): Promise<MemoryEntry[]>;
	writeEntry(
		dir: string,
		topic: MemoryType,
		entry: Omit<MemoryEntry, "id" | "addedAt" | "title" | "type"> & { title?: string },
	): Promise<MemoryEntry>;
	editEntry(dir: string, id: string, newText: string): Promise<MemoryEntry | null>;
	removeEntry(dir: string, id: string): Promise<boolean>;
	listEntries(dir: string, topic?: MemoryType): Promise<MemoryEntry[]>;
	findEntry(dir: string, id: string): Promise<MemoryEntry | null>;
	entryExists(dir: string, text: string): Promise<boolean>;
	clearAll(dir: string): Promise<void>;
	rebuildIndex(dir: string): Promise<void>;
	injectIndex(dir: string): Promise<string>;
}

export interface MemoryState {
	ready: boolean;
	config: MemoryConfig;
	identity: ProjectIdentity | null;
	memoryDir: string | null;
	pendingAutoCaptureCandidates: string[];
}

export interface MemoryCommandDeps {
	state: MemoryState;
	storage: StorageAPI;
	setEnabledGlobal?: (enabled: boolean) => Promise<boolean>;
	setEnabledProject?: (enabled: boolean) => Promise<boolean>;
}

export type MemoryCommandHandler = (
	args: string,
	ctx: ExtensionCommandContext,
	deps: MemoryCommandDeps,
) => Promise<void>;
