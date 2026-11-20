import { z } from "zod";

export const RoleProfile = z.object({
  techStack: z
    .array(z.string().min(1))
    .max(12)
    .describe(
      "Tools and technologies THIS role uses on this project, as stated in the brief. Empty if not stated.",
    ),
  responsibilities: z
    .array(
      z.object({
        description: z
          .string()
          .min(1)
          .max(150)
          .describe(
            "A piece of work this person will own or deliver, one sentence",
          ),
        source: z
          .enum(["brief", "role_description"])
          .describe(
            "'brief' if the project brief states it; 'role_description' if it is a general duty of the role",
          ),
      }),
    )
    .min(1)
    .max(6),
  keyContacts: z
    .array(z.string().min(1))
    .max(6)
    .describe(
      "Team ROLES the joiner should meet first, e.g. 'tech lead'. Roles only, never names.",
    ),
  missingInformation: z
    .array(z.string())
    .describe(
      "Anything needed for the profile that the brief did not state. Empty if nothing is missing.",
    ),
});

export type RoleProfile = z.infer<typeof RoleProfile>;
