import { Client } from "ssh2";
import { randomBytes } from "crypto";

const DO_API_TOKEN = process.env.DO_TOKEN;
const DO_DROPLET_ID = process.env.DO_DROPLET_ID; // MVP: single pre-created droplet
const DO_SSH_USER = process.env.DO_SSH_USER ?? "root";
const DO_SSH_PRIVATE_KEY_RAW = process.env.DO_SSH_PRIVATE_KEY ?? "";

/** Normalize PEM key from env: restore newlines if stored as literal \n */
function normalizePrivateKey(key: string): string {
  if (!key) return key;
  return key.replace(/\\n/g, "\n").trim();
}
const AGENT_IMAGE = process.env.AGENT_IMAGE ?? "ghcr.io/your-org/claudebot-agent:latest";
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

export interface ProvisionResult {
  dropletId: string | null;
  containerId: string | null;
  error?: string;
}

function getSshConnection(): Promise<{ host: string; connect: () => Promise<Client> }> {
  return new Promise((resolve, reject) => {
    if (!DO_DROPLET_ID || !DO_SSH_PRIVATE_KEY_RAW) {
      reject(new Error("DO_DROPLET_ID and DO_SSH_PRIVATE_KEY must be set for provisioning"));
      return;
    }
    const privateKey = normalizePrivateKey(DO_SSH_PRIVATE_KEY_RAW);
    if (!DO_API_TOKEN) {
      reject(new Error("DO_TOKEN must be set for provisioning"));
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch(`https://api.digitalocean.com/v2/droplets/${DO_DROPLET_ID}`, {
      headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
      signal: controller.signal,
    })
      .then((r) => {
        clearTimeout(timeout);
        if (!r.ok) return r.json().then((d: { message?: string }) => Promise.reject(new Error(d.message || `DO API ${r.status}`)));
        return r.json();
      })
      .then((data: { droplet?: { id: number; status: string; networks?: { v4?: { ip_address: string }[] } } }) => {
        const droplet = data.droplet;
        if (!droplet || droplet.status !== "active") {
          reject(new Error("Droplet not found or not active"));
          return;
        }
        const ip = droplet.networks?.v4?.[0]?.ip_address;
        if (!ip) {
          reject(new Error("Droplet has no IP"));
          return;
        }
        resolve({
          host: ip,
          connect: () =>
            new Promise<Client>((res, rej) => {
              const c = new Client();
              c.on("ready", () => res(c));
              c.on("error", rej);
              c.connect({
                host: ip,
                port: 22,
                username: DO_SSH_USER,
                privateKey,
              });
            }),
        });
      })
      .catch((e: unknown) => {
        clearTimeout(timeout);
        if (e instanceof Error) {
          if (e.name === "AbortError") reject(new Error("DigitalOcean API request timed out (15s)"));
          else {
            const cause = e.cause instanceof Error ? e.cause.message : (e.cause ? String(e.cause) : "");
            reject(new Error(cause ? `${e.message} (${cause})` : e.message));
          }
        } else reject(e);
      });
  });
}

function runSshCommand(conn: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      let out = "";
      let errOut = "";
      stream
        .on("data", (d: Buffer) => {
          out += d.toString();
        })
        .stderr?.on("data", (d: Buffer) => {
          errOut += d.toString();
        });
      stream.on("close", (code: number) => {
        if (code !== 0) reject(new Error(errOut || out || `Exit code ${code}`));
        else resolve(out.trim());
      });
    });
  });
}

export async function startBotContainer(
  botId: string,
  logToken: string,
  configJson: string
): Promise<ProvisionResult> {
  const safeBotId = botId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const containerName = `bot-${safeBotId}`;

  try {
    const { connect } = await getSshConnection();
    const conn = await connect();

    try {
      await runSshCommand(conn, "which docker || (apt-get update -qq && apt-get install -qq -y docker.io)");
    } catch {
      // ignore if docker already there
    }

    const configB64 = Buffer.from(configJson, "utf-8").toString("base64");
    const envAnthropic = ANTHROPIC_API_KEY ? ` -e ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY.replace(/'/g, "'\\''")}` : "";
    const runCmd = `docker run -d --name ${containerName} --restart unless-stopped -e BOT_ID=${safeBotId} -e API_URL=${API_URL} -e LOG_TOKEN=${logToken} -e CONFIG_B64=${configB64}${envAnthropic} ${AGENT_IMAGE}`;
    const out = await runSshCommand(conn, runCmd);
    conn.end();
    const containerId = out.slice(0, 12) || null;
    return { dropletId: DO_DROPLET_ID ?? null, containerId };
  } catch (e) {
    return {
      dropletId: DO_DROPLET_ID ?? null,
      containerId: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function stopBotContainer(botId: string): Promise<{ error?: string }> {
  const safeBotId = botId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const containerName = `bot-${safeBotId}`;
  try {
    const { connect } = await getSshConnection();
    const conn = await connect();
    await runSshCommand(conn, `docker stop ${containerName} 2>/dev/null; docker rm ${containerName} 2>/dev/null; true`);
    conn.end();
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function generateLogToken(): string {
  return randomBytes(32).toString("hex");
}
