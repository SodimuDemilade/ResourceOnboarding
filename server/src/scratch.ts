import { z } from "zod";
import { OnboardingIntake } from "@onboarding/shared";

const bad = OnboardingIntake.safeParse({
  fullName: "Priya",
  projectId: "atlas",
});
if (!bad.success) console.log(z.prettifyError(bad.error));

const good = OnboardingIntake.safeParse({
  fullName: "Priya Shah",
  roleId: "frontend-dev",
  projectId: "atlas",
  startDate: "2026-11-23",
  contractType: "employee",
  location: "New York",
});
console.log(good.success, good.data);
