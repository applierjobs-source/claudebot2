import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth.js";
import { botsRouter } from "./routes/bots.js";
import { templatesRouter } from "./routes/templates.js";
import { logsRouter } from "./routes/logs.js";
import { memoryRouter } from "./routes/memory.js";
import { healthRouter } from "./routes/health.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.set("trust proxy", 1);

const corsOrigin = process.env.WEB_ORIGIN ?? "*";
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: "Too many requests" },
});
app.use("/api", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/bots", botsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/logs", logsRouter);
app.use("/api/memory", memoryRouter);
app.use("/health", healthRouter);

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
