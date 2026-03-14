import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, apiFetch } from "../context/AuthContext";

type Bot = {
  id: string;
  name: string | null;
  status: string;
  template: { name: string; description: string | null };
  createdAt: string;
};

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/bots", {}, token)
      .then((r) => r.json())
      .then((data) => { setBots(data.bots || []); })
      .catch(() => setBots([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>My Bots</h1>
          <p style={{ color: "var(--muted)", margin: "0.25rem 0 0" }}>{user?.email}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/create"><button className="primary">Create Bot</button></Link>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      ) : bots.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>You don't have any bots yet.</p>
          <Link to="/create"><button className="primary">Create your first bot</button></Link>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {bots.map((bot) => (
            <li key={bot.id}>
              <Link to={`/bot/${bot.id}`} style={{ display: "block", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1rem 1.25rem", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <strong>{bot.name || bot.template.name}</strong>
                    <span className={`badge ${bot.status}`} style={{ marginLeft: "0.5rem" }}>{bot.status}</span>
                    <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>{bot.template.description || bot.template.name}</p>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>View →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
