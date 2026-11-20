import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic } from "./client.js";

export type Usage = { inputTokens: number; outputTokens: number };

export type StructuredResult<T> =
  | { ok: true; data: T; attempts: number; usage: Usage }
  | {
      ok: false;
      reason: "refusal" | "truncated" | "invalid_output";
      detail: string;
      attempts: number;
      usage: Usage;
      rawOutput?: string;
    };

type StructuredCall<S extends z.ZodObject> = {
  model: string;
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
};

const MAX_ATTEMPTS = 2; // first try + one retry

//<S extends z.ZodObject> is a generic that accepts any Zod object schema (RoleProfile, a guide schema, and so on).
// z.infer<S> in the return type means: call it with RoleProfile and data is typed as a RoleProfile. One function serves every agent with full type safety.
export async function callStructured<S extends z.ZodObject>(
  call: StructuredCall<S>,
): Promise<StructuredResult<z.infer<S>>> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: call.prompt },
  ];
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let lastText = "";
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await anthropic.messages.create({
      model: call.model,
      max_tokens: call.maxTokens ?? 2000,
      system: call.system,
      messages,
      output_config: { format: zodOutputFormat(call.schema) },
    });

    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        reason: "refusal",
        detail: "The model declined to complete the request.",
        attempts: attempt,
        usage,
      };
    }
    if (response.stop_reason === "max_tokens") {
      return {
        ok: false,
        reason: "truncated",
        detail: "The reply was cut off by max_tokens.",
        attempts: attempt,
        usage,
      };
    }

    lastText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let json: unknown;
    try {
      json = JSON.parse(lastText);
    } catch {
      json = undefined;
    }

    const result = call.schema.safeParse(json);
    if (result.success) {
      return {
        ok: true,
        data: result.data,
        attempts: attempt,
        usage,
      };
    }

    lastError =
      json === undefined
        ? "Output was not a valid JSON."
        : z.prettifyError(result.error);

    messages.push({ role: "assistant", content: lastText });
    messages.push({
      role: "user",
      content: `Your answer failed validation:\n${lastError}\nReturn a corrected answer.`,
    });
  }

  return {
    ok: false,
    reason: "invalid_output",
    detail: lastError,
    attempts: MAX_ATTEMPTS,
    usage,
    rawOutput: lastText,
  };
}
