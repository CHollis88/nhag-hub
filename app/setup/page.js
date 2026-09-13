"use client";

import { useState } from "react";

export default function SetupPage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "80px auto",
        padding: 32,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      <h2>Finish setting up your account</h2>
      <form onSubmit={submit}>
        <label style={{ display: "block", marginBottom: 4 }}>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="jsmith"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12, boxSizing: "border-box" }}
        />
        <p style={{ color: "#666", fontSize: 13, marginTop: -8, marginBottom: 16 }}>
          Lowercase letters, numbers, and underscores only. 3–20 characters.
        </p>

        <label style={{ display: "block", marginBottom: 4 }}>Display name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Jane Smith"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 20, boxSizing: "border-box" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 12, fontSize: 16, background: "#16296B", color: "#fff", border: "none", borderRadius: 6 }}
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
      {error && <p style={{ color: "crimson", marginTop: 12 }}>{error}</p>}
    </div>
  );
}
