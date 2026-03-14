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
