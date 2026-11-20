import { z } from "zod";
import { ProjectId } from "./intake.js";

// Reference data: written in access-catalogue.json, never by the LLM
export const CatalogueItem = z.object({
  id: z.string().min(1),
  projectIds: z.array(ProjectId),
  name: z.string().min(1),
  system: z.string().min(1),
  requiresApproval: z.boolean(),
  requiresNda: z.boolean(),
  employeeOnly: z.boolean(),
  clientSystem: z.boolean(),
});

// Agent output: built at runtime so catalogueId can only be a real catalogue ID
export function makeAccessRecommendation(catalogueIds: string[]) {
  return z.object({
    items: z
      .array(
        z.object({
          catalogueId: z
            .enum(catalogueIds)
            .describe("ID of an item from the access catalogue."),
          justification: z
            .string()
            .min(1)
            .max(200)
            .describe(
              "Why this person needs this access for this role and project.",
            ),
        }),
      )
      .max(15),
    missingInformation: z
      .array(z.string())
      .describe(
        "Anything needed to decide access that was not provided. Empty if nothing is missing.",
      ),
  });
}

export type CatalogueItem = z.infer<typeof CatalogueItem>;
export type AccessRecommendation = z.infer<
  ReturnType<typeof makeAccessRecommendation>
>;
