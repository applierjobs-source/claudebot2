import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "";

type User = { id: string; email: string; name: string | null };

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Login failed");
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Signup failed");
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) {
          setToken(null);
          setUser(null);
          localStorage.removeItem("token");
          return;
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((data) => data && setUser(data.user))
      .catch(() => { /* only clear on 401 above; keep token on network/other errors */ });
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function apiFetch(path: string, options: RequestInit = {}, token?: string | null) {
  const t = token ?? localStorage.getItem("token");
  const headers = new Headers(options.headers);
  if (t) headers.set("Authorization", `Bearer ${t}`);
  return fetch((API || "") + path, { ...options, headers });
}
