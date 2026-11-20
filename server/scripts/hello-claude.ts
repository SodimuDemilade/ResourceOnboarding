import { anthropic } from "../src/llm/client.js";
import { config } from "../src/config.js";

const response = await anthropic.messages.create({
  model: config.models.specialist,
  max_tokens: 200,
  messages: [
    {
      role: "user",
      content: "In one sentence, what is a multi-agent AI system?",
    },
  ],
});

const first = response.content[0];
console.log(first?.type === "text" ? first.text : first);
console.log("stop_reason:", response.stop_reason);
console.log(
  "tokens:",
  response.usage.input_tokens,
  "in /",
  response.usage.output_tokens,
  "out",
);
