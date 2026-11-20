import { z } from "zod";

export const ContractType = z.enum(["employee", "contractor"]);
export const ProjectId = z.enum(["atlas", "orion", "nova"]);
export const RoleId = z.enum([
  "frontend-dev",
  "mobile-dev",
  "backend-dev",
  "qa",
  "business-analyst",
]);
export const Seniority = z.enum(["junior", "mid", "senior", "lead"]);

export const OnboardingIntake = z.object({
  fullName: z.string().min(1),
  roleId: RoleId,
  seniority: Seniority,
  projectId: ProjectId,
  startDate: z.iso.date(),
  contractType: ContractType,
  location: z.string().min(1),
});

export type ProjectId = z.infer<typeof ProjectId>;
export type RoleId = z.infer<typeof RoleId>;
export type ContractType = z.infer<typeof ContractType>;
export type Seniority = z.infer<typeof Seniority>;
export type OnboardingIntake = z.infer<typeof OnboardingIntake>;
