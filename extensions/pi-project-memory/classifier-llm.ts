import { complete, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

import type { MemoryClassification } from "./classifier.js";

const SYSTEM_PROMPT = `You classify whether a line should be remembered for future project sessions.
Return ONLY JSON with:
- isMemory: boolean
- memoryType: decision|pattern|preference|gotcha
- normalizedText: string
- confidence: number (0..1)
- category: architecture|tooling|data|policy|quality|workflow
- reason: short string

Mark isMemory=false for one-off execution requests (e.g. run tests, create file now, update route now).`;

function extractJsonObject(text: string): string | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	return text.slice(start, end + 1);
}

export async function classifyMemoryWithLLM(line: string, ctx: ExtensionContext): Promise<MemoryClassification | null> {
	if (!ctx.model) return null;
	// Compat shim: pi 0.69+ renamed `getApiKey(model)` → `getApiKeyAndHeaders(model)`.
	// `getApiKeyForProvider(provider)` exists in both, so prefer it.
	const registry = ctx.modelRegistry as unknown as {
		getApiKeyForProvider?: (provider: string) => Promise<string | undefined>;
		getApiKey?: (model: unknown) => Promise<string | undefined>;
		getApiKeyAndHeaders?: (model: unknown) => Promise<{ apiKey?: string } | undefined>;
	};
	let apiKey: string | undefined;
	if (typeof registry.getApiKeyForProvider === "function") {
		apiKey = await registry.getApiKeyForProvider(ctx.model.provider);
	} else if (typeof registry.getApiKey === "function") {
		apiKey = await registry.getApiKey(ctx.model);
	} else if (typeof registry.getApiKeyAndHeaders === "function") {
		const res = await registry.getApiKeyAndHeaders(ctx.model);
		apiKey = res?.apiKey;
	}
	if (!apiKey) return null;

	const userMessage: UserMessage = {
		role: "user",
		content: [{ type: "text", text: line }],
		timestamp: Date.now(),
	};

	const result = await complete(ctx.model, { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] }, { apiKey });
	const text = result.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n");
	const json = extractJsonObject(text);
	if (!json) return null;

	try {
		const parsed = JSON.parse(json) as Omit<MemoryClassification, "source">;
		if (typeof parsed.isMemory !== "boolean") return null;
		if (!["decision", "pattern", "preference", "gotcha"].includes(parsed.memoryType)) return null;
		if (typeof parsed.normalizedText !== "string") return null;
		if (typeof parsed.confidence !== "number") return null;
		if (!["architecture", "tooling", "data", "policy", "quality", "workflow"].includes(parsed.category)) return null;
		if (typeof parsed.reason !== "string") return null;

		return {
			...parsed,
			confidence: Math.max(0, Math.min(1, parsed.confidence)),
			normalizedText: parsed.normalizedText.trim(),
			reason: parsed.reason.trim(),
			source: "llm",
		};
	} catch {
		return null;
	}
}
