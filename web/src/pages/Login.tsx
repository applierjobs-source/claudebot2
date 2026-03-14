import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, token } = useAuth();
  const navigate = useNavigate();

  if (token) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
  };

  return (
    <div className="container" style={{ paddingTop: "4rem", maxWidth: "400px" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Claude Bot Platform</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>Sign in to manage your bots</p>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: "var(--error)", marginBottom: "1rem" }}>{error}</p>}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button type="submit" className="primary" style={{ width: "100%" }}>Sign in</button>
      </form>
      <p style={{ marginTop: "1.5rem", color: "var(--muted)" }}>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
