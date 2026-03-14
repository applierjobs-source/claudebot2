import https from "https";
import { Client } from "ssh2";
import { randomBytes } from "crypto";

const DO_API_TOKEN = process.env.DO_TOKEN;
const DO_DROPLET_ID = process.env.DO_DROPLET_ID;
const DO_DROPLET_IP = process.env.DO_DROPLET_IP; // optional: use this to skip DO API call (avoids ETIMEDOUT from Railway)
const DO_SSH_USER = process.env.DO_SSH_USER ?? "root";
const DO_SSH_PRIVATE_KEY_RAW = process.env.DO_SSH_PRIVATE_KEY ?? "";

/** Normalize PEM key from env: restore newlines, or rebuild if pasted as one line */
function normalizePrivateKey(key: string): string {
  if (!key) return key;
  let k = key.replace(/\\n/g, "\n").trim();
  // If key is one line (env var stripped newlines), rebuild PEM
  if (!k.includes("\n") && k.includes("-----BEGIN")) {
    const begin = "-----BEGIN OPENSSH PRIVATE KEY-----";
    const end = "-----END OPENSSH PRIVATE KEY-----";
    const beginIdx = k.indexOf(begin);
    const endIdx = k.indexOf(end);
    if (beginIdx !== -1 && endIdx > beginIdx) {
      const middle = k.slice(beginIdx + begin.length, endIdx).replace(/\s/g, "");
      const lines: string[] = [begin];
      for (let i = 0; i < middle.length; i += 70) lines.push(middle.slice(i, i + 70));
      lines.push(end);
      k = lines.join("\n");
    }
  }
  return k;
}
const AGENT_IMAGE = process.env.AGENT_IMAGE ?? "ghcr.io/your-org/claudebot-agent:latest";
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

export interface ProvisionResult {
  dropletId: string | null;
  containerId: string | null;
  error?: string;
}

function fetchDropletInfo(): Promise<{ ip: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.digitalocean.com",
        path: `/v2/droplets/${DO_DROPLET_ID}`,
        method: "GET",
        headers: { Authorization: `Bearer ${DO_API_TOKEN}` },
        timeout: 15000,
      },
      (res) => {
        let body = "";
        res.on("data", (ch) => (body += ch));
        res.on("end", () => {
          try {
            const data = JSON.parse(body) as { droplet?: { status: string; networks?: { v4?: { ip_address: string }[] } } };
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
            resolve({ ip });
          } catch {
            reject(new Error(res.statusCode ? `DO API ${res.statusCode}: ${body.slice(0, 200)}` : "Invalid DO API response"));
          }
        });
      }
    );
    req.on("error", (e: NodeJS.ErrnoException) => {
      const msg = e.code ? `DigitalOcean API: ${e.code} - ${e.message}` : e.message;
      reject(new Error(msg));
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("DigitalOcean API request timed out (15s)"));
    });
    req.end();
  });
}

function getSshConnection(): Promise<{ host: string; connect: () => Promise<Client> }> {
  if (!DO_SSH_PRIVATE_KEY_RAW) {
    return Promise.reject(new Error("DO_SSH_PRIVATE_KEY must be set for provisioning"));
  }
  const privateKey = normalizePrivateKey(DO_SSH_PRIVATE_KEY_RAW);

  const connectWithIp = (ip: string) => ({
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

  if (DO_DROPLET_IP && DO_DROPLET_IP.trim()) {
    return Promise.resolve(connectWithIp(DO_DROPLET_IP.trim()));
  }

  if (!DO_DROPLET_ID || !DO_API_TOKEN) {
    return Promise.reject(new Error("Set DO_DROPLET_IP (recommended), or DO_DROPLET_ID and DO_TOKEN for provisioning"));
  }
  const maxAttempts = 3;
  let lastErr: Error | null = null;
  const tryFetch = (attempt: number): Promise<{ ip: string }> =>
    fetchDropletInfo().catch((e) => {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts) {
        return new Promise((res, rej) => setTimeout(() => tryFetch(attempt + 1).then(res, rej), 2000));
      }
      return Promise.reject(lastErr);
    });
  return tryFetch(1).then(({ ip }) => connectWithIp(ip));
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
