import { Router, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";
import { startBotContainer, stopBotContainer, generateLogToken } from "../services/provision.js";

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

botsRouter.post("/", async (req, res) => {
  const userId = (req as unknown as { user: { userId: string } }).user.userId;
  const { templateId, name } = req.body as { templateId?: string; name?: string };
  if (!templateId) {
    res.status(400).json({ error: "templateId required" });
    return;
  }
  const template = await prisma.botTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const count = await prisma.bot.count({ where: { userId } });
  if (count >= 10) {
    res.status(429).json({ error: "Maximum bots per user reached" });
    return;
  }
  const logToken = generateLogToken();
  const configSnapshot = {
    systemPrompt: template.systemPrompt,
    allowedTools: template.allowedTools,
    maxRuntimeMinutes: template.maxRuntimeMinutes,
    maxTokensPerRun: template.maxTokensPerRun,
    maxSpendCents: template.maxSpendCents,
    startupActions: template.startupActions,
    scheduleCron: template.scheduleCron,
  };
  const bot = await prisma.bot.create({
    data: {
      userId,
      templateId,
      name: name ?? `${template.name} Bot`,
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
