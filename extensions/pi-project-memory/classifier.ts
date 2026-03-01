export type ClassifierMemoryType = "decision" | "pattern" | "preference" | "gotcha";
export type ClassifierCategory = "architecture" | "tooling" | "data" | "policy" | "quality" | "workflow";

export interface MemoryClassification {
	isMemory: boolean;
	memoryType: ClassifierMemoryType;
	normalizedText: string;
	confidence: number;
	category: ClassifierCategory;
	reason: string;
	source: "rule" | "llm";
}

const patterns: Array<{ re: RegExp; memoryType: ClassifierMemoryType; category: ClassifierCategory; confidence: number; reason: string }> = [
	{ re: /\b(use|adopt|standardize on|we will use)\b/i, memoryType: "decision", category: "tooling", confidence: 0.88, reason: "technology choice" },
	{ re: /\b(do not|don't|never|avoid)\b/i, memoryType: "decision", category: "policy", confidence: 0.86, reason: "constraint rule" },
	{ re: /\b(architecture|policy|convention)\b/i, memoryType: "decision", category: "architecture", confidence: 0.8, reason: "architecture/policy statement" },
	{ re: /\b(always|every time|consistently)\b/i, memoryType: "pattern", category: "quality", confidence: 0.75, reason: "repeatable pattern" },
	{ re: /\b(prefer|i prefer|we prefer|i like|we like)\b/i, memoryType: "preference", category: "workflow", confidence: 0.74, reason: "user/team preference" },
	{ re: /\b(don't forget|watch out|be careful|gotcha|footgun|trap|caveat)\b/i, memoryType: "gotcha", category: "workflow", confidence: 0.82, reason: "pitfall warning" },
];

function normalizeText(text: string): string {
	return text.replace(/^\s*(?:[-*]\s*)?/, "").trim().replace(/\s+/g, " ");
}

export function classifyMemoryRule(line: string): MemoryClassification {
	const normalized = normalizeText(line);
	if (/^(?:can|could|would|will)\s+you\b|^(?:can|could|would|will)\s+\w+\b|^(?:please\s+)?(?:scan|tell\s+me|look\s+at|check|analy[sz]e)\b/i.test(normalized)) {
		return {
			isMemory: false,
			memoryType: "decision",
			normalizedText: normalized,
			confidence: 0.05,
			category: "workflow",
			reason: "task/question request",
			source: "rule",
		};
	}
	if (normalized.length < 8) {
		return {
			isMemory: false,
			memoryType: "decision",
			normalizedText: normalized,
			confidence: 0.1,
			category: "workflow",
			reason: "too short",
			source: "rule",
		};
	}
	if (/^(create|run|fix|update)\b/i.test(normalized)) {
		return {
			isMemory: false,
			memoryType: "decision",
			normalizedText: normalized,
			confidence: 0.2,
			category: "workflow",
			reason: "one-off task instruction",
			source: "rule",
		};
	}

	for (const p of patterns) {
		if (p.re.test(normalized)) {
			return {
				isMemory: true,
				memoryType: p.memoryType,
				normalizedText: normalized,
				confidence: p.confidence,
				category: p.category,
				reason: p.reason,
				source: "rule",
			};
		}
	}

	if (/\b(we will|must|should)\b/i.test(normalized)) {
		return {
			isMemory: true,
			memoryType: "decision",
			normalizedText: normalized,
			confidence: 0.65,
			category: "policy",
			reason: "directive statement",
			source: "rule",
		};
	}

	return {
		isMemory: false,
		memoryType: "decision",
		normalizedText: normalized,
		confidence: 0.35,
		category: "workflow",
		reason: "low confidence",
		source: "rule",
	};
}
