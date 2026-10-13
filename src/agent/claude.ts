import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Brief } from "../blueprint/brief.js";
import { BriefSchema } from "../plan/expand.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface PlanInput {
  description: string;
  evidenceText?: string;
  answers?: { question: string; answer: string }[];
  model?: string;
}

export class PlannerError extends Error {}

/**
 * One structured-output call. The model returns a Brief (modules, labels, extra fields, tools); everything
 * after that (blueprint expansion, code generation) is deterministic, so the model never writes React.
 */
export async function planWithClaude(input: PlanInput, client: Anthropic = new Anthropic()): Promise<Brief> {
  let response;
  try {
    response = await client.messages.parse({
      model: input.model ?? process.env.RCRM_MODEL ?? DEFAULT_MODEL,
      max_tokens: 16000,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      output_config: { format: zodOutputFormat(BriefSchema) },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new PlannerError("Anthropic authentication failed. Set ANTHROPIC_API_KEY (or run `ant auth login`), or pass --offline.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new PlannerError("Anthropic rate limit hit. Wait a moment and retry.");
    }
    if (err instanceof Anthropic.APIError) {
      throw new PlannerError(`Anthropic API error ${err.status}: ${err.message}`);
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new PlannerError("The model declined to plan this request. Rephrase the description, or pass --offline.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new PlannerError("The plan was cut off (max_tokens). Try a shorter description.");
  }
  if (!response.parsed_output) {
    throw new PlannerError("The model returned a plan that did not match the schema. Retry, or pass --offline.");
  }
  return response.parsed_output;
}
