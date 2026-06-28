import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Claude is an enhancement layer, not a dependency — every page that calls it
// has a deterministic fallback for the actual numbers. When the call fails
// (no key, no credits, rate limit, etc.) we never want to surface the raw
// API error text to users; just say the AI layer is unavailable.
export function describeAgentError(): string {
  return "AI-enhanced suggestions are temporarily unavailable. The data above is unaffected.";
}
