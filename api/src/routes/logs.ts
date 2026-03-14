import { Router, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, requireLogToken } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const logsRouter = Router();

// Ingest: bot containers send logs with X-Log-Token (no JWT)
logsRouter.post("/ingest", requireLogToken, async (req, res) => {
  const logToken = (req as Request & { logToken: string }).logToken;
  const bot = await prisma.bot.findFirst({ where: { logToken } });
  if (!bot) {
    res.status(401).json({ error: "Invalid log token" });
    return;
  }
  const body = req.body as
    | { level: string; message: string; meta?: object }
    | { logs: { level: string; message: string; meta?: object }[] };
  type LogEntry = { level?: string; message?: string; meta?: object };
  const entries: LogEntry[] = "logs" in body && Array.isArray(body.logs) ? body.logs : [body as LogEntry];
  const run = await prisma.botRun.findFirst({
    where: { botId: bot.id, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  await prisma.botLog.createMany({
    data: entries.map((e) => ({
      botId: bot.id,
      runId: run?.id,
      level: e.level ?? "info",
      message: e.message ?? "",
      meta: e.meta ?? undefined,
    })),
  });
  await prisma.bot.update({
    where: { id: bot.id },
    data: { lastHeartbeatAt: new Date() },
  });
  res.json({ ok: true, count: entries.length });
});

// List: authenticated user, their bot's logs
logsRouter.get("/bot/:botId", authMiddleware, async (req, res) => {
  const userId = (req as Request & { user: { userId: string } }).user.userId;
  const botId = req.params.botId;
  const bot = await prisma.bot.findFirst({ where: { id: botId, userId } });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const cursor = req.query.cursor as string | undefined;
  const logs = await prisma.botLog.findMany({
    where: { botId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = logs.length > limit ? logs[limit - 1]?.id : null;
  const list = logs.slice(0, limit);
  res.json({ logs: list, nextCursor });
});
