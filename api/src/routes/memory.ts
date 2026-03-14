import { Router, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { requireLogToken } from "../middleware/auth.js";
import { authMiddleware } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const memoryRouter = Router();

// Bot runtime: get/set memory via X-Log-Token
memoryRouter.get("/", requireLogToken, async (req, res) => {
  const logToken = (req as Request & { logToken: string }).logToken;
  const bot = await prisma.bot.findFirst({ where: { logToken } });
  if (!bot) {
    res.status(401).json({ error: "Invalid log token" });
    return;
  }
  const entries = await prisma.botMemory.findMany({
    where: { botId: bot.id },
    select: { key: true, value: true },
  });
  const obj: Record<string, unknown> = {};
  for (const e of entries) obj[e.key] = e.value;
  res.json(obj);
});

memoryRouter.post("/", requireLogToken, async (req, res) => {
  const logToken = (req as Request & { logToken: string }).logToken;
  const bot = await prisma.bot.findFirst({ where: { logToken } });
  if (!bot) {
    res.status(401).json({ error: "Invalid log token" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  for (const [key, value] of Object.entries(body)) {
    await prisma.botMemory.upsert({
      where: { botId_key: { botId: bot.id, key } },
      create: { botId: bot.id, key, value: value as object },
      update: { value: value as object },
    });
  }
  res.json({ ok: true });
});

// User: read bot memory (dashboard)
memoryRouter.get("/bot/:botId", authMiddleware, async (req, res) => {
  const userId = (req as Request & { user: { userId: string } }).user.userId;
  const bot = await prisma.bot.findFirst({ where: { id: req.params.botId, userId } });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  const entries = await prisma.botMemory.findMany({
    where: { botId: bot.id },
    select: { key: true, value: true, updatedAt: true },
  });
  res.json({ memory: entries });
});
