import { z } from "zod";
import { ProjectId, RoleId } from "./intake.js";

// Reference data: written by us in server/mock-data, never produced by the LLM.

export const Project = z.object({
  id: ProjectId,
  name: z.string().min(1),
  client: z.string().min(1),
  requiresNda: z.boolean(),
  requiresBackgroundCheck: z.boolean(),
  team: z
    .array(z.object({ name: z.string().min(1), role: z.string().min(1) }))
    .min(1),
});
export type Project = z.infer<typeof Project>;

export const Role = z.object({
  id: RoleId,
  title: z.string().min(1),
  description: z.string().min(1),
});
export type Role = z.infer<typeof Role>;

export const DocMeta = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  projectIds: z.array(ProjectId), // empty = relevant to every project
});
export type DocMeta = z.infer<typeof DocMeta>;
