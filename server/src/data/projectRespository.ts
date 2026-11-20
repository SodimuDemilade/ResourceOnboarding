import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Project, Role, type ProjectId, type RoleId } from "@onboarding/shared";

const dataDir = join(import.meta.dirname, "..", "..", "mock-data");

function loadJson<T>(file: string, schema: z.ZodType<T>): T {
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
  return schema.parse(raw); // throws on bad data: our own files should never be invalid
}

// Loaded once, when this module is first imported
const projects = loadJson("projects.json", z.array(Project));
const roles = loadJson("roles.json", z.array(Role));

export function getProject(id: ProjectId): Project {
  const project = projects.find((p) => p.id === id);
  if (!project) throw new Error(`Unknown project: ${id}`);
  return project;
}

export function getProjectBrief(id: ProjectId): string {
  return readFileSync(join(dataDir, "projects", `${id}.md`), "utf8");
}

export function getRole(id: RoleId): Role {
  const role = roles.find((r) => r.id === id);
  if (!role) throw new Error(`Unknown role: ${id}`);
  return role;
}
