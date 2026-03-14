import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, apiFetch } from "../context/AuthContext";

type Template = {
  id: string;
  name: string;
  description: string | null;
  allowedTools: string[];
  maxRuntimeMinutes: number;
  maxTokensPerRun: number;
  maxSpendCents: number;
};

export default function CreateBot() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/templates", {}, token)
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]));
  }, [token]);

  const handleCreate = async () => {
    if (!selected) { setError("Select a template"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected, name: name || undefined }),
      }, token);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "Failed to create bot");
      navigate(`/bot/${data.bot.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create bot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: "2rem" }}>
        <Link to="/" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>← Dashboard</Link>
        <h1 style={{ margin: "0.5rem 0 0" }}>Create Bot</h1>
        <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>Choose a template and start your autonomous agent</p>
      </header>

      {error && <p style={{ color: "var(--error)", marginBottom: "1rem" }}>{error}</p>}

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Bot name (optional)</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Faucet Hunter" style={{ maxWidth: "400px" }} />
      </div>

      <p style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Template</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
        {templates.map((t) => (
          <label
            key={t.id}
            style={{
              display: "block",
              background: selected === t.id ? "rgba(167, 139, 250, 0.1)" : "var(--surface)",
              border: `1px solid ${selected === t.id ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              cursor: "pointer",
            }}
          >
            <input type="radio" name="template" value={t.id} checked={selected === t.id} onChange={() => setSelected(t.id)} style={{ width: "auto", marginRight: "0.5rem" }} />
            <strong>{t.name}</strong>
            {t.description && <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>{t.description}</p>}
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
              Limits: {t.maxRuntimeMinutes} min · {Math.round(t.maxTokensPerRun / 1000)}k tokens · ${(t.maxSpendCents / 100).toFixed(2)} max
            </p>
          </label>
        ))}
      </div>

      <button className="primary" onClick={handleCreate} disabled={loading}>
        {loading ? "Creating..." : "Create Bot"}
      </button>
    </div>
  );
}
