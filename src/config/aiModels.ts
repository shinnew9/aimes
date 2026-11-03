// OpenAI model configuration
// Centralizes which model each kind of call uses, plus the request parameters
// those models require, so models can be swapped from .env.local without
// touching any call site.
//
// Background: the gpt-4 / gpt-4-turbo / gpt-3.5-turbo models this app used are
// shut down 2026-10-23, and gpt-4o on 2027-01-14. Their replacements are
// reasoning models, which differ from gpt-4o in two ways that break old calls:
//   1. `max_tokens` is rejected; they take `max_completion_tokens`.
//   2. `temperature` other than the default is rejected *unless* reasoning is
//      turned off with `reasoning_effort: 'none'` (gpt-5.6 and newer only).
// Reasoning tokens are also drawn from the same budget as the reply, so a small
// `max_completion_tokens` with reasoning left on returns an empty message
// rather than an error. Hence 'none' for the short, conversational calls.

/**
 * CHAT     - live counselor/patient dialogue. Short replies, needs temperature
 *            for variety, latency is visible to the user.
 * ANALYSIS - scoring, feedback and JSON reports. Large token budgets, so
 *            reasoning is affordable and improves the result.
 * UTILITY  - cheap one-off calls (session titles, crisis flags). Tiny budgets.
 */
export type ModelRole = 'CHAT' | 'ANALYSIS' | 'UTILITY';

/** `'none'` disables reasoning; `undefined` omits the parameter altogether. */
type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high' | null;

export interface ModelRequestParams {
  model: string;
  max_completion_tokens: number;
  reasoning_effort?: ReasoningEffort;
  temperature?: number;
}

// Chosen per role from measurements against our own prompts: see
// docs/gpt5-migration-plan.md for the latency, truncation and scoring numbers.
const DEFAULT_MODEL: Record<ModelRole, string> = {
  // luna is the fastest tier (1.6s vs 2.9s for terra on our counseling prompt)
  // and the only one concise enough that replies are not cut off mid-sentence.
  CHAT: 'gpt-5.6-luna',
  // terra for the scoring work, where agreeing with our existing rubric matters
  // more than speed. luna was the only tier to grade outside the 8-9 band.
  ANALYSIS: 'gpt-5.6-terra',
  UTILITY: 'gpt-5.6-luna'
};

const DEFAULT_EFFORT: Record<ModelRole, string> = {
  CHAT: 'none',
  ANALYSIS: 'low',
  UTILITY: 'none'
};

// Client-side services read NEXT_PUBLIC_*; API routes accept either. Both names
// are spelled out in full because Next.js inlines these by literal match.
const MODEL_OVERRIDE: Record<ModelRole, string | undefined> = {
  CHAT: process.env.NEXT_PUBLIC_OPENAI_MODEL_CHAT || process.env.OPENAI_MODEL_CHAT,
  ANALYSIS: process.env.NEXT_PUBLIC_OPENAI_MODEL_ANALYSIS || process.env.OPENAI_MODEL_ANALYSIS,
  UTILITY: process.env.NEXT_PUBLIC_OPENAI_MODEL_UTILITY || process.env.OPENAI_MODEL_UTILITY
};

const EFFORT_OVERRIDE: Record<ModelRole, string | undefined> = {
  CHAT: process.env.NEXT_PUBLIC_OPENAI_REASONING_CHAT ?? process.env.OPENAI_REASONING_CHAT,
  ANALYSIS: process.env.NEXT_PUBLIC_OPENAI_REASONING_ANALYSIS ?? process.env.OPENAI_REASONING_ANALYSIS,
  UTILITY: process.env.NEXT_PUBLIC_OPENAI_REASONING_UTILITY ?? process.env.OPENAI_REASONING_UTILITY
};

/** The model id a given kind of call will use. Also recorded on saved reports. */
export function modelFor(role: ModelRole): string {
  return MODEL_OVERRIDE[role]?.trim() || DEFAULT_MODEL[role];
}

function effortFor(role: ModelRole): string | undefined {
  const configured = EFFORT_OVERRIDE[role];
  // An env var set to an empty string is a deliberate "omit this parameter",
  // which is what a non-reasoning model such as gpt-4o needs for comparison runs.
  const effort = (configured === undefined ? DEFAULT_EFFORT[role] : configured).trim();
  return effort === '' ? undefined : effort;
}

/**
 * Builds the model and token/reasoning parameters for a call. Spread it into an
 * `openai.chat.completions.create()` argument or a raw request body.
 *
 * `temperature` is passed through only when reasoning is off, because reasoning
 * models reject any non-default value. Setting a role's reasoning env var to an
 * empty string while it points at a reasoning model will therefore send a
 * temperature the API rejects with a 400 — switch the model too.
 */
export function modelParams(
  role: ModelRole,
  options: { maxTokens: number; temperature?: number }
): ModelRequestParams {
  const effort = effortFor(role);
  const params: ModelRequestParams = {
    model: modelFor(role),
    max_completion_tokens: options.maxTokens
  };

  if (effort !== undefined) {
    // The installed SDK (6.2.0) predates gpt-5.6 and does not list 'none' in
    // its ReasoningEffort union, though the API accepts it. Cast until the SDK
    // is upgraded.
    params.reasoning_effort = effort as ReasoningEffort;
  }

  if (options.temperature !== undefined && (effort === 'none' || effort === undefined)) {
    params.temperature = options.temperature;
  }

  return params;
}
