import { z } from "zod";
import { callStructured } from "../src/llm/structured.js";
import { config } from "../src/config.js";

const Strict = z.object({
  tips: z
    .array(z.string())
    .max(2)
    .refine(
      (tips) => tips.every((t) => t.length <= 100),
      "Each tip must be 100 characters or fewer",
    ),
});

const result = await callStructured({
  model: config.models.specialist,
  system: "You give onboarding tips.",
  prompt: "Give me 6 tips for a new developer joining a project.",
  schema: Strict,
});

console.log(JSON.stringify(result, null, 2));
