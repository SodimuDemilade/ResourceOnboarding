import {
  RoleProfile,
  Seniority,
  type ProjectId,
  type RoleId,
} from "@onboarding/shared";
import { config } from "../../config.js";
import { callStructured, type StructuredResult } from "../../llm/structured.js";
import {
  getProject,
  getProjectBrief,
  getRole,
} from "../../data/projectRespository.js";
import { SYSTEM_PROMPT, buildPrompt } from "./prompt.js";

export type RoleAnalystInput = {
  projectId: ProjectId;
  roleId: RoleId;
  seniority: Seniority;
};

export async function runRoleAnalyst(
  input: RoleAnalystInput,
): Promise<StructuredResult<RoleProfile>> {
  const project = getProject(input.projectId);
  const role = getRole(input.roleId);
  const brief = getProjectBrief(input.projectId);

  return callStructured({
    model: config.models.specialist,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(project, role, brief, input.seniority),
    schema: RoleProfile,
    maxTokens: 1500,
  });
}
