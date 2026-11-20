import type {
  AccessRecommendation,
  CatalogueItem,
  OnboardingIntake,
  Project,
  Task,
} from "@onboarding/shared";
import { getBaselineItems, getCatalogueItem } from "../data/accessCatalogue.js";

export type BuildTasksInput = {
  caseId: string;
  intake: OnboardingIntake;
  project: Project;
  access: AccessRecommendation | null; // null if the Access agent failed or did not run
};

export function buildTasks({
  caseId,
  intake,
  project,
  access,
}: BuildTasksInput): Task[] {
  const tasks: Task[] = [];
  // Every task needs caseId; this helper adds it so each task below can leave it out
  const add = (task: Omit<Task, "caseId">) => tasks.push({ caseId, ...task });

  if (project.requiresNda) {
    add({
      id: "nda",
      stage: "compliance",
      owner: "new_joiner",
      title: `Sign ${project.client} NDA`,
      description: `Sign the non-disclosure agreement required by ${project.client}. Client systems cannot be accessed until it is signed.`,
      dependsOn: [],
      requiresApproval: false,
      status: "not_started",
    });
  }
  if (project.requiresBackgroundCheck) {
    add({
      id: "background-check",
      stage: "compliance",
      owner: "coordinator",
      title: "Complete background check",
      description: `Complete the background check required by ${project.client}. Client system access waits until it is cleared.`,
      dependsOn: [],
      requiresApproval: false,
      status: "not_started",
    });
  }
  add({
    id: "trainings",
    stage: "compliance",
    owner: "new_joiner",
    title: "Complete mandatory trainings",
    description: "Security awareness and data protection.",
    dependsOn: [],
    requiresApproval: false,
    status: "not_started",
  });

  add({
    id: "laptop",
    stage: "provisioning",
    owner: "it",
    title: "Provide laptop and equipment",
    description: `Ready before ${intake.startDate}.`,
    dependsOn: [],
    requiresApproval: false,
    status: "not_started",
  });

  const accessTask = (
    item: CatalogueItem,
    description: string,
  ): Omit<Task, "caseId"> => {
    const id = `access-${item.id}`;
    const dependsOn: string[] = [];
    if (item.requiresNda && project.requiresNda) dependsOn.push("nda");
    if (item.clientSystem && project.requiresBackgroundCheck)
      dependsOn.push("background-check");

    return {
      id,
      stage: "provisioning",
      catalogueId: item.id,
      owner: item.requiresApproval ? "approver" : "it",
      title: `Access: ${item.name}`,
      description,
      dependsOn,
      requiresApproval: item.requiresApproval,
      status: item.requiresApproval ? "awaiting_approval" : "not_started",
    };
  };

  for (const item of getBaselineItems()) {
    add(accessTask(item, "Standard access for every team member."));
  }

  const seenIds = new Set<string>();
  for (const item of access?.items ?? []) {
    if (!seenIds.has(item.catalogueId)) {
      const catalogueItem = getCatalogueItem(item.catalogueId);
      if (!catalogueItem) {
        throw new Error(`${item.catalogueId} is not a valid catalogue ID.`);
      }
      add(accessTask(catalogueItem, item.justification));
    }
    seenIds.add(item.catalogueId);
  }

  add({
    id: "buddy",
    stage: "orientation",
    owner: "coordinator",
    title: "Assign a buddy and schedule team introductions",
    description: `For ${intake.fullName}'s first week.`,
    dependsOn: [],
    requiresApproval: false,
    status: "not_started",
  });

  return tasks;
}
