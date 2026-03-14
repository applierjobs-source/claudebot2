import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, apiFetch } from "../context/AuthContext";

const VALID_TOOLS = [
  "browse_page",
  "extract_content",
  "http_request",
  "read_file",
  "write_file",
  "list_dir",
  "store_memory",
  "get_memory",
  "complete",
];

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
  const [customPrompt, setCustomPrompt] = useState("");
  const [customTools, setCustomTools] = useState<string[]>(["get_memory", "store_memory", "complete"]);

  const isCustom = selected !== null && templates.some((t) => t.id === selected && t.name === "Custom");
  const templatesSorted = [...templates].sort((a, b) => (a.name === "Custom" ? -1 : b.name === "Custom" ? 1 : 0));

  useEffect(() => {
    apiFetch("/api/templates", {}, token)
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => setTemplates([]));
  }, [token]);

  const toggleTool = (tool: string) => {
    setCustomTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handleCreate = async () => {
    if (!selected) {
      setError("Select a template or Custom");
      return;
    }
    if (isCustom) {
      if (!customPrompt.trim()) {
        setError("Enter a system prompt for your custom bot");
        return;
      }
      if (customTools.length === 0) {
        setError("Select at least one tool");
        return;
      }
    }
    setError("");
    setLoading(true);
    try {
      const payload = isCustom
        ? {
            name: name || undefined,
            systemPrompt: customPrompt.trim(),
            allowedTools: customTools,
          }
        : { templateId: selected, name: name || undefined };
      const res = await apiFetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, token);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.detail
          ? `${data.error || "Failed to create bot"}: ${data.detail}`
          : (data.error || data.detail || `Failed to create bot (${res.status})`);
        throw new Error(msg);
      }
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
        <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>Choose a template or create a custom bot with your own prompt and tools</p>
      </header>

      {error && (
        <div style={{ color: "var(--error)", marginBottom: "1rem", padding: "0.75rem", background: "rgba(239,68,68,0.1)", borderRadius: "8px", fontSize: "0.9rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Bot name (optional)</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Faucet Hunter" style={{ maxWidth: "400px" }} />
      </div>

      <p style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Template</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {templatesSorted.map((t) => {
          const isCustomOption = t.name === "Custom";
          return (
            <label
              key={t.id}
              style={{
                display: "block",
                background: selected === t.id
                  ? isCustomOption ? "rgba(167, 139, 250, 0.18)" : "rgba(167, 139, 250, 0.1)"
                  : isCustomOption ? "rgba(167, 139, 250, 0.06)" : "var(--surface)",
                border: `2px solid ${selected === t.id ? "var(--accent)" : isCustomOption ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <input type="radio" name="template" value={t.id} checked={selected === t.id} onChange={() => setSelected(t.id)} style={{ width: "auto", marginRight: "0.5rem" }} />
              {isCustomOption && (
                <span style={{ position: "absolute", top: "0.75rem", right: "1rem", fontSize: "0.7rem", fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  No template
                </span>
              )}
              <strong>{t.name}</strong>
              {t.description && <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>{t.description}</p>}
              {!isCustomOption && (
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                  Limits: {t.maxRuntimeMinutes} min · {Math.round(t.maxTokensPerRun / 1000)}k tokens · ${(t.maxSpendCents / 100).toFixed(2)} max
                </p>
              )}
            </label>
          );
        })}
      </div>

      {isCustom && (
        <div style={{ marginBottom: "2rem", padding: "1.25rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <p style={{ marginBottom: "0.5rem", fontWeight: 600 }}>System prompt</p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="e.g. You are a research assistant. Visit the URLs the user provides and summarize the main points. Use get_memory to read user instructions."
            rows={5}
            style={{ width: "100%", maxWidth: "600px", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "inherit", fontFamily: "inherit", fontSize: "0.9rem", resize: "vertical" }}
          />
          <p style={{ marginTop: "1rem", marginBottom: "0.5rem", fontWeight: 600 }}>Tools (select at least one)</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
            {VALID_TOOLS.map((tool) => (
              <label key={tool} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.9rem" }}>
                <input type="checkbox" checked={customTools.includes(tool)} onChange={() => toggleTool(tool)} style={{ width: "auto" }} />
                {tool}
              </label>
            ))}
          </div>
        </div>
      )}

      <button className="primary" onClick={handleCreate} disabled={loading}>
        {loading ? "Creating..." : "Create Bot"}
      </button>
    </div>
  );
}
