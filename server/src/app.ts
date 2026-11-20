import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import {
  OnboardingIntake,
  ProjectId,
  TaskStatusUpdate,
  type CaseListItem,
} from "@onboarding/shared";
import { HttpError, type CaseService } from "./services/caseService.js";

export function createApp(service: CaseService) {
  const app = express();
  app.use(express.json());

  // Create a case: validates, starts the orchestrator, returns at once
  app.post("/cases", async (req, res) => {
    const intake = OnboardingIntake.safeParse(req.body);
    if (!intake.success) {
      res.status(400).json({
        error: "Invalid intake",
        details: z.prettifyError(intake.error),
      });
      return;
    }
    const record = await service.createCase(intake.data);
    res
      .status(202)
      .location(`/cases/${record.id}`)
      .json({ id: record.id, state: record.state });
  });

  app.get("/cases", async (_req, res) => {
    const cases = await service.listCases();
    const items: CaseListItem[] = cases.map((c) => ({
      id: c.id,
      fullName: c.intake.fullName,
      projectId: c.intake.projectId,
      state: c.state,
      createdAt: c.createdAt,
    }));
    res.status(200).json(items);
  });

  app.get("/cases/:id", async (req, res) => {
    const view = await service.getCase(req.params.id);
    res.json(view);
  });

  app.post("/cases/:id/tasks/:taskId/status", async (req, res) => {
    const taskUpdate = TaskStatusUpdate.safeParse(req.body);
    if (!taskUpdate.success) {
      res.status(400).json({
        error: "Invalid task status",
        details: z.prettifyError(taskUpdate.error),
      });
      return;
    }

    const view = await service.updateTaskStatus(
      req.params.id,
      req.params.taskId,
      taskUpdate.data.status,
    );
    res.json(view);
  });

  app.get("/cases/:id/trace", async (req, res) => {
    const trace = await service.getTrace(req.params.id);
    res.json(trace);
  });

  // One place that turns errors into HTTP responses
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // instanceof checks whether an object was created from a particular class.
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
