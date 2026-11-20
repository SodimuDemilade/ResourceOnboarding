import {
  makeAccessRecommendation,
  type AccessRecommendation,
  type ProjectId,
  type RoleId,
  type RoleProfile,
} from "@onboarding/shared";
import { config } from "../../config.js";
import { callStructured, type StructuredResult } from "../../llm/structured.js";
import {
  getProject,
  getProjectBrief,
  getRole,
} from "../../data/projectRespository.js";
import { getProjectItems } from "../../data/accessCatalogue.js";
import { SYSTEM_PROMPT, buildPrompt } from "./prompt.js";

export type AccessToolsInput = {
  projectId: ProjectId;
  roleId: RoleId;
  roleProfile: RoleProfile;
};

export async function runAccessTools(
  input: AccessToolsInput,
): Promise<StructuredResult<AccessRecommendation>> {
  const project = getProject(input.projectId);
  const role = getRole(input.roleId);
  const brief = getProjectBrief(input.projectId);
  const catalogue = getProjectItems(input.projectId);

  // The schema is built from exactly the items the agent is shown
  const schema = makeAccessRecommendation(catalogue.map((item) => item.id));

  // The LLM judges need only; rules (approval, NDA, employee-only) are applied by code later
  return callStructured({
    model: config.models.specialist,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(project, role, brief, input.roleProfile, catalogue),
    schema,
    maxTokens: 1500,
  });
}
