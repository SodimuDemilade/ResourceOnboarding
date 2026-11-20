// Checks every mock-data file against the shared schemas.
// Run from the server folder:  npx tsx scripts/validate-mock-data.ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CatalogueItem, DocMeta, Project, ProjectId, Role } from "@onboarding/shared";

const dataDir = join(import.meta.dirname, "..", "mock-data");
const problems: string[] = [];

function load<T>(file: string, schema: z.ZodType<T>): T[] {
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, file), "utf8"));
  const result = z.array(schema).safeParse(raw);
  if (!result.success) {
    problems.push(`${file}:\n${z.prettifyError(result.error)}`);
    return [];
  }
  const ids = result.data.map((item) => (item as { id: string }).id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) problems.push(`${file}: duplicate ids ${duplicates.join(", ")}`);
  console.log(`✓ ${file}: ${result.data.length} entries`);
  return result.data;
}

const projects = load("projects.json", Project);
load("roles.json", Role);
load("access-catalogue.json", CatalogueItem);
const docs = load("docs-index.json", DocMeta);

// Cross-file checks that Zod alone cannot do
for (const id of ProjectId.options) {
  if (!projects.some((p) => p.id === id)) problems.push(`projects.json: no entry for project "${id}"`);
  if (!existsSync(join(dataDir, "projects", `${id}.md`))) problems.push(`missing brief: projects/${id}.md`);
}
for (const doc of docs) {
  if (!existsSync(join(dataDir, "docs", `${doc.id}.md`))) problems.push(`missing document: docs/${doc.id}.md`);
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} problem(s):\n\n${problems.join("\n\n")}`);
  process.exit(1);
}
console.log("\nAll mock data is valid.");
