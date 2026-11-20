import { z } from "zod";

export const Stage = z.enum([
  "intake",
  "analysis",
  "compliance",
  "provisioning",
  "orientation",
  "readiness",
]);
export const Owner = z.enum([
  "coordinator",
  "new_joiner",
  "approver",
  "it",
  "agent",
]);
export const Status = z.enum([
  "not_started",
  "in_progress",
  "awaiting_approval",
  "done",
  "rejected",
]);

export const ProposedTask = z.object({
  title: z
    .string()
    .min(1)
    .max(100)
    .describe("Short action, e.g. 'Request GitHub access'"),
  description: z
    .string()
    .min(1)
    .max(500)
    .describe("What needs to happen and why, one or two sentences"),
});

export const Task = ProposedTask.extend({
  id: z.string().min(1),
  caseId: z.string().min(1),
  stage: Stage,
  owner: Owner,
  dependsOn: z.array(z.string().min(1)),
  requiresApproval: z.boolean(),
  status: Status,
  catalogueId: z.string().min(1).optional(),
});

export type ProposedTask = z.infer<typeof ProposedTask>;
export type Task = z.infer<typeof Task>;
export type Stage = z.infer<typeof Stage>;
export type Owner = z.infer<typeof Owner>;
export type Status = z.infer<typeof Status>;
