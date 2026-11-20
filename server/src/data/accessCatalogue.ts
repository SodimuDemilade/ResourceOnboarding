import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CatalogueItem, type ProjectId } from "@onboarding/shared";

const file = join(
  import.meta.dirname,
  "..",
  "..",
  "mock-data",
  "access-catalogue.json",
);
const catalogue = z
  .array(CatalogueItem)
  .parse(JSON.parse(readFileSync(file, "utf8")));

/** Granted to everyone on every project. Code adds these; the agent never sees them. */
export function getBaselineItems(): CatalogueItem[] {
  return catalogue.filter((item) => item.projectIds.length === 0);
}

/** Items specific to this project. The agent judges whether this person needs each. */
export function getProjectItems(projectId: ProjectId): CatalogueItem[] {
  return catalogue.filter((item) => item.projectIds.includes(projectId));
}

export function getCatalogueItem(id: string): CatalogueItem | undefined {
  return catalogue.find((item) => item.id === id);
}
