import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, apiFetch } from "../context/AuthContext";

type Bot = {
  id: string;
  name: string | null;
  status: string;
  template: { name: string; description: string | null };
  lastHeartbeatAt: string | null;
  createdAt: string;
};

type LogEntry = {
  id: string;
  level: string;
  message: string;
  meta: object | null;
  createdAt: string;
};

export default function BotDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [bot, setBot] = useState<Bot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageStatus, setMessageStatus] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    apiFetch(`/api/bots/${id}`, {}, token)
      .then((r) => r.json())
      .then((data) => setBot(data))
      .catch(() => setBot(null));
    apiFetch(`/api/logs/bot/${id}?limit=100`, {}, token)
      .then((r) => r.json())
      .then((data) => setLogs(data.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id, token]);

  const doAction = async (action: "stop" | "restart" | "delete") => {
    if (!id) return;
    setActioning(action);
    try {
      if (action === "delete") {
        await apiFetch(`/api/bots/${id}`, { method: "DELETE" }, token);
        window.location.href = "/";
        return;
      }
      await apiFetch(`/api/bots/${id}/${action}`, { method: "POST" }, token);
      load();
    } finally {
      setActioning(null);
    }
  };

  const sendMessage = async () => {
    const msg = userMessage.trim();
    if (!id || !msg) return;
    setMessageSending(true);
    setMessageStatus(null);
    try {
      const r = await apiFetch(`/api/bots/${id}/message`, {
        method: "POST",
        body: JSON.stringify({ message: msg }),
        headers: { "Content-Type": "application/json" },
      }, token);
      const data = r.ok ? await r.json().catch(() => ({})) : null;
      if (r.ok) {
        setUserMessage("");
        setMessageStatus(data?.message || "Message sent. The bot will read it on its next loop.");
      } else {
        setMessageStatus("Failed to send");
      }
    } catch {
      setMessageStatus("Failed to send");
    } finally {
      setMessageSending(false);
    }
  };

  if (!bot && !loading) {
    return (
      <div className="container">
        <p>Bot not found.</p>
        <Link to="/">← Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <header style={{ marginBottom: "1.5rem" }}>
        <Link to="/" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>← Dashboard</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginTop: "0.5rem" }}>
          <div>
            <h1 style={{ margin: 0 }}>{bot?.name || bot?.template?.name || "Bot"}</h1>
            <span className={`badge ${bot?.status || "stopped"}`} style={{ marginTop: "0.25rem", display: "inline-block" }}>{bot?.status}</span>
            {bot?.lastHeartbeatAt && <span style={{ color: "var(--muted)", fontSize: "0.85rem", marginLeft: "0.5rem" }}>Last heartbeat: {new Date(bot.lastHeartbeatAt).toLocaleString()}</span>}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link to={`/bot/${id}/activity`}><button>Activity</button></Link>
            {bot?.status === "running" && (
              <button onClick={() => doAction("stop")} disabled={!!actioning}>Stop</button>
            )}
            {bot?.status === "stopped" && (
              <button className="primary" onClick={() => doAction("restart")} disabled={!!actioning}>Restart</button>
            )}
            <button className="danger" onClick={() => doAction("delete")} disabled={!!actioning}>{actioning === "delete" ? "..." : "Delete"}</button>
          </div>
        </div>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Send instruction to bot</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Your message will be read by the bot on its next loop. Use this to give new goals or context (e.g. &quot;Find emails on https://example.com&quot;).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "32rem" }}>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            placeholder="e.g. Search this URL for contact emails..."
            rows={3}
            style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "inherit", resize: "vertical" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button onClick={sendMessage} disabled={messageSending || !userMessage.trim()} className="primary">
              {messageSending ? "Sending..." : "Send"}
            </button>
            {messageStatus && <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{messageStatus}</span>}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Logs</h2>
        <div style={{ background: "#0c0c0e", border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem", fontFamily: "monospace", fontSize: "0.85rem", maxHeight: "500px", overflowY: "auto" }}>
          {loading && logs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Loading...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No logs yet.</p>
          ) : (
            [...logs].reverse().map((log) => (
              <div key={log.id} style={{ marginBottom: "0.5rem", borderLeft: `3px solid ${log.level === "error" ? "var(--error)" : log.level === "action" ? "var(--accent)" : "var(--border)"}`, paddingLeft: "0.5rem" }}>
                <span style={{ color: "var(--muted)", marginRight: "0.5rem" }}>{new Date(log.createdAt).toISOString()}</span>
                <span className={`badge ${log.level}`} style={{ marginRight: "0.5rem" }}>{log.level}</span>
                {log.message}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
