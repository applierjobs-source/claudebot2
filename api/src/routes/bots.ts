import { Router, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";
import { startBotContainer, stopBotContainer, generateLogToken } from "../services/provision.js";
import { VALID_TOOLS } from "../seed-templates.js";

const prisma = new PrismaClient();
export const botsRouter = Router();

botsRouter.use("/", authMiddleware);

botsRouter.get("/", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const bots = await prisma.bot.findMany({
    where: { userId },
    include: { template: { select: { name: true, description: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ bots });
});

botsRouter.get("/:id", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const bot = await prisma.bot.findFirst({
    where: { id: req.params.id, userId },
    include: { template: true },
  });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  res.json(bot);
});

botsRouter.post("/:id/message", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const bot = await prisma.bot.findFirst({ where: { id: req.params.id, userId } });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  const body = req.body as { message?: string };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    res.status(400).json({ error: "message required" });
    return;
  }
  await prisma.botMemory.upsert({
    where: { botId_key: { botId: bot.id, key: "user_message" } },
    create: {
      botId: bot.id,
      key: "user_message",
      value: { text: message, at: new Date().toISOString() },
    },
    update: {
      value: { text: message, at: new Date().toISOString() },
    },
  });
  res.json({ ok: true, message: "Message sent. The bot will read it on its next loop." });
});

botsRouter.post("/", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const body = req.body as {
    templateId?: string;
    name?: string;
    systemPrompt?: string;
    allowedTools?: string[];
    maxRuntimeMinutes?: number;
    maxTokensPerRun?: number;
    maxSpendCents?: number;
    startupActions?: unknown;
  };
  const templateIdRaw = body.templateId != null ? String(body.templateId).trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : undefined;

  let template: { id: string; name: string; systemPrompt: string; allowedTools: string[]; maxRuntimeMinutes: number; maxTokensPerRun: number; maxSpendCents: number; startupActions: unknown; scheduleCron: string | null } | null;
  let configSnapshot: object;

  // Prefer template flow when templateId is present (so template create is never treated as custom)
  if (templateIdRaw && !(typeof body.systemPrompt === "string" && body.systemPrompt.trim())) {
    // Template bot: use template by id
    template = await prisma.botTemplate.findUnique({ where: { id: templateIdRaw } });
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    configSnapshot = {
      systemPrompt: template.systemPrompt,
      allowedTools: template.allowedTools,
      maxRuntimeMinutes: template.maxRuntimeMinutes,
      maxTokensPerRun: template.maxTokensPerRun,
      maxSpendCents: template.maxSpendCents,
      startupActions: template.startupActions,
      scheduleCron: template.scheduleCron,
    };
  } else if (typeof body.systemPrompt === "string" && body.systemPrompt.trim()) {
    // Custom bot: no template, use body
    const customPrompt = body.systemPrompt.trim();
    const rawTools = Array.isArray(body.allowedTools) ? body.allowedTools : [];
    const allowedTools = rawTools.filter((t): t is string => typeof t === "string" && VALID_TOOLS.includes(t));
    if (allowedTools.length === 0) {
      res.status(400).json({ error: "allowedTools must include at least one valid tool", validTools: VALID_TOOLS });
      return;
    }
    template = await prisma.botTemplate.findFirst({ where: { name: "Custom" } });
    if (!template) {
      res.status(503).json({ error: "Custom template not found; run seed or restart API" });
      return;
    }
    configSnapshot = {
      systemPrompt: customPrompt,
      allowedTools,
      maxRuntimeMinutes: typeof body.maxRuntimeMinutes === "number" && body.maxRuntimeMinutes > 0 ? Math.min(body.maxRuntimeMinutes, 480) : 60,
      maxTokensPerRun: typeof body.maxTokensPerRun === "number" && body.maxTokensPerRun > 0 ? Math.min(body.maxTokensPerRun, 200000) : 60000,
      maxSpendCents: typeof body.maxSpendCents === "number" && body.maxSpendCents > 0 ? Math.min(body.maxSpendCents, 1000) : 200,
      startupActions: body.startupActions ?? null,
      scheduleCron: null,
    };
  } else {
    res.status(400).json({ error: "templateId required, or provide systemPrompt and allowedTools for a custom bot" });
    return;
  }

  const count = await prisma.bot.count({ where: { userId } });
  if (count >= 10) {
    res.status(429).json({ error: "Maximum bots per user reached" });
    return;
  }
  const logToken = generateLogToken();
  const bot = await prisma.bot.create({
    data: {
      userId,
      templateId: template.id,
      name: name || (template.name === "Custom" ? "Custom Bot" : `${template.name} Bot`),
      status: "pending",
      configSnapshot,
      logToken,
    },
    include: { template: { select: { name: true } } },
  });

  const configJson = JSON.stringify(configSnapshot);
  const result = await startBotContainer(bot.id, logToken, configJson);
  if (result.error) {
    await prisma.bot.update({
      where: { id: bot.id },
      data: { status: "error", configSnapshot: { ...(configSnapshot as object), provisionError: result.error } },
    });
    res.status(502).json({
      bot,
      error: "Failed to start container",
      detail: result.error,
    });
    return;
  }
  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      status: "running",
      dropletId: result.dropletId,
      containerId: result.containerId,
      lastHeartbeatAt: new Date(),
    },
  });
  await prisma.botRun.create({
    data: { botId: bot.id, status: "running" },
  });
  const updated = await prisma.bot.findUnique({
    where: { id: bot.id },
    include: { template: { select: { name: true, description: true } } },
  });
  res.status(201).json({ bot: updated });
});

botsRouter.post("/:id/stop", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const bot = await prisma.bot.findFirst({ where: { id: req.params.id, userId } });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  await stopBotContainer(bot.id);
  await prisma.bot.update({ where: { id: bot.id }, data: { status: "stopped" } });
  const run = await prisma.botRun.findFirst({ where: { botId: bot.id, status: "running" }, orderBy: { startedAt: "desc" } });
  if (run) await prisma.botRun.update({ where: { id: run.id }, data: { status: "stopped", endedAt: new Date() } });
  res.json({ ok: true, status: "stopped" });
});

botsRouter.post("/:id/restart", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const bot = await prisma.bot.findFirst({ where: { id: req.params.id, userId }, include: { template: true } });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  await stopBotContainer(bot.id);
  const configSnapshot = (bot.configSnapshot as object) || {};
  const configJson = JSON.stringify(configSnapshot);
  const result = await startBotContainer(bot.id, bot.logToken!, configJson);
  if (result.error) {
    await prisma.bot.update({ where: { id: bot.id }, data: { status: "error" } });
    res.status(502).json({ error: "Failed to restart", detail: result.error });
    return;
  }
  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      status: "running",
      dropletId: result.dropletId,
      containerId: result.containerId,
      lastHeartbeatAt: new Date(),
    },
  });
  res.json({ ok: true, status: "running" });
});

botsRouter.get("/:id/runs", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const bot = await prisma.bot.findFirst({ where: { id: req.params.id, userId } });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  const runs = await prisma.botRun.findMany({
    where: { botId: bot.id },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  res.json({ runs });
});

botsRouter.delete("/:id", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const bot = await prisma.bot.findFirst({ where: { id: req.params.id, userId } });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  await stopBotContainer(bot.id);
  await prisma.bot.delete({ where: { id: bot.id } });
  res.json({ ok: true });
});
