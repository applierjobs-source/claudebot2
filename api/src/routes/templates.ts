import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const templatesRouter = Router();

templatesRouter.get("/", async (_req, res) => {
  const list = await prisma.botTemplate.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      allowedTools: true,
      maxRuntimeMinutes: true,
      maxTokensPerRun: true,
      maxSpendCents: true,
    },
  });
  res.json({ templates: list });
});

templatesRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  const t = await prisma.botTemplate.findUnique({ where: { id } });
  if (!t) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(t);
});

// Admin-only in MVP we skip; optional later
templatesRouter.post("/", authMiddleware, async (req, res) => {
  const body = req.body as {
    name: string;
    description?: string;
    systemPrompt: string;
    allowedTools: string[];
    scheduleCron?: string;
    maxRuntimeMinutes: number;
    maxTokensPerRun: number;
    maxSpendCents: number;
    startupActions?: unknown;
  };
  if (!body.name || !body.systemPrompt || !Array.isArray(body.allowedTools)) {
    res.status(400).json({ error: "name, systemPrompt, allowedTools required" });
    return;
  }
  const t = await prisma.botTemplate.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      systemPrompt: body.systemPrompt,
      allowedTools: body.allowedTools,
      scheduleCron: body.scheduleCron ?? null,
      maxRuntimeMinutes: body.maxRuntimeMinutes ?? 60,
      maxTokensPerRun: body.maxTokensPerRun ?? 100_000,
      maxSpendCents: body.maxSpendCents ?? 500,
      startupActions: body.startupActions ?? undefined,
    },
  });
  res.status(201).json(t);
});
