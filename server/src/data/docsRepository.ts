import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { DocMeta, type ProjectId } from "@onboarding/shared";

const file = join(
  import.meta.dirname,
  "..",
  "..",
  "mock-data",
  "docs-index.json",
);
const docs = z.array(DocMeta).parse(JSON.parse(readFileSync(file, "utf8")));

/** General documents (empty projectIds) plus this project's own documents. */
export function getDocsForProject(projectId: ProjectId): DocMeta[] {
  return docs.filter(
    (doc) => doc.projectIds.length === 0 || doc.projectIds.includes(projectId),
  );
}
