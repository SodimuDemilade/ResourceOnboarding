import { z } from "zod";

export function makeOnboardingGuide(docIds: string[]) {
  return z.object({
    summary: z
      .string()
      .min(1)
      .max(600)
      .describe(
        "2-3 sentences welcoming the joiner, naming the project and what their role will focus on",
      ),
    firstWeekPlan: z
      .array(
        z.object({
          theme: z
            .string()
            .min(1)
            .max(60)
            .describe("Focus of the day, e.g. 'Access and environment setup'"),
          activities: z
            .array(z.string().min(1).max(150))
            .min(1)
            .max(5)
            .describe(
              "Concrete activities for the day, one short sentence each",
            ),
        }),
      )
      .length(5)
      .describe(
        "Exactly 5 entries, one per working day in order: the first entry is day 1",
      ),
    recommendedDocs: z
      .array(
        z.object({
          docId: z
            .enum(docIds)
            .describe("ID of a document from the docs repository"),
          reason: z
            .string()
            .min(1)
            .max(200)
            .describe("Why this document matters for this person's role"),
        }),
      )
      .min(1)
      .max(6),
    missingInformation: z
      .array(z.string())
      .describe(
        "Anything needed to tailor the guide that was not provided. Empty if nothing is missing.",
      ),
  });
}

export type OnboardingGuide = z.infer<ReturnType<typeof makeOnboardingGuide>>;
