import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth, apiFetch } from "../context/AuthContext";

type Run = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  tokensUsed: number;
  spendCents: number;
  summary: string | null;
};

type LogEntry = {
  id: string;
  level: string;
  message: string;
  meta: object | null;
  createdAt: string;
};

export default function Activity() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [botName, setBotName] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/bots/${id}`, {}, token)
      .then((r) => r.json())
      .then((data) => setBotName(data.name || data.template?.name || "Bot"));
    apiFetch(`/api/bots/${id}/runs`, {}, token)
      .then((r) => r.json())
      .then((data) => setRuns(data.runs || []));
    apiFetch(`/api/logs/bot/${id}?limit=80`, {}, token)
      .then((r) => r.json())
      .then((data) => setLogs(data.logs || []));
  }, [id, token]);

  return (
    <div className="container">
      <header style={{ marginBottom: "2rem" }}>
        <Link to={`/bot/${id}`} style={{ color: "var(--muted)", fontSize: "0.9rem" }}>← {botName || "Bot"}</Link>
        <h1 style={{ margin: "0.5rem 0 0" }}>Activity</h1>
        <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>Runs and recent actions</p>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Runs</h2>
        {runs.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No runs yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {runs.map((run) => (
              <li key={run.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem", marginBottom: "0.5rem" }}>
                <span className={`badge ${run.status}`}>{run.status}</span>
                <span style={{ marginLeft: "0.5rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                  Started {new Date(run.startedAt).toLocaleString()}
                  {run.endedAt && ` · Ended ${new Date(run.endedAt).toLocaleString()}`}
                </span>
                {(run.tokensUsed > 0 || run.spendCents > 0) && (
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>· {run.tokensUsed} tokens · ${(run.spendCents / 100).toFixed(2)}</span>
                )}
                {run.summary && <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>{run.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Recent logs</h2>
        <div style={{ background: "#0c0c0e", border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem", fontFamily: "monospace", fontSize: "0.85rem", maxHeight: "400px", overflowY: "auto" }}>
          {logs.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No logs.</p>
          ) : (
            [...logs].reverse().map((log) => (
              <div key={log.id} style={{ marginBottom: "0.4rem" }}>
                <span style={{ color: "var(--muted)", marginRight: "0.5rem" }}>{new Date(log.createdAt).toLocaleTimeString()}</span>
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
