import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `Missing environment variable ${name}. Add it to server/.env`,
    );
  return value;
}

export const config = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  models: {
    orchestrator: "claude-sonnet-5-5",
    specialist: "claude-haiku-5-5",
  },
  databaseUrl: process.env.DATABASE_URL, // optional: without it, storage is in memory
} as const;
