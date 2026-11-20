import {
  makeOnboardingGuide,
  type OnboardingGuide,
  type ProjectId,
  type RoleId,
  type RoleProfile,
  type Seniority,
} from "@onboarding/shared";
import { config } from "../../config.js";
import { callStructured, type StructuredResult } from "../../llm/structured.js";
import {
  getProject,
  getProjectBrief,
  getRole,
} from "../../data/projectRespository.js";
import { getDocsForProject } from "../../data/docsRepository.js";
import { SYSTEM_PROMPT, buildPrompt } from "./prompt.js";

export type GuidanceInput = {
  projectId: ProjectId;
  roleId: RoleId;
  fullName: string;
  seniority: Seniority;
  roleProfile: RoleProfile;
};

export async function runGuidance(
  input: GuidanceInput,
): Promise<StructuredResult<OnboardingGuide>> {
  // Code gathers facts and narrows the documents to this project
  const project = getProject(input.projectId);
  const role = getRole(input.roleId);
  const brief = getProjectBrief(input.projectId);
  const docs = getDocsForProject(input.projectId);

  // The schema only accepts IDs of the documents the agent is shown
  const schema = makeOnboardingGuide(docs.map((doc) => doc.id));

  // The LLM writes the tailored guide
  return callStructured({
    model: config.models.specialist,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(
      project,
      role,
      brief,
      input.fullName,
      input.seniority,
      input.roleProfile,
      docs,
    ),
    schema,
    maxTokens: 4000,
  });
}
