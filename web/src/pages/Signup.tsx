import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { signup, token } = useAuth();
  const navigate = useNavigate();

  if (token) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signup(email, password, name || undefined);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed");
    }
  };

  return (
    <div className="container" style={{ paddingTop: "4rem", maxWidth: "400px" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Create account</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>Run your own Claude bots in the cloud</p>
      <form onSubmit={handleSubmit}>
        {error && <p style={{ color: "var(--error)", marginBottom: "1rem" }}>{error}</p>}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={6} />
        </div>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>Name (optional)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <button type="submit" className="primary" style={{ width: "100%" }}>Sign up</button>
      </form>
      <p style={{ marginTop: "1.5rem", color: "var(--muted)" }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
