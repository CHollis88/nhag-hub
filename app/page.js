"use client";

import { useState } from "react";

export default function SetupPage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (pin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, display_name: displayName, pin }),
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-navydeep">
      <div className="max-w-[420px] w-full p-8 rounded-2xl bg-card">
        <h2 className="font-serif text-xl text-ink mb-1">Finish setting up your account</h2>
        <p className="text-sm text-inkfaint mb-5">
          Your PIN is how you'll sign in from now on — pick one you'll remember.
        </p>
        <form onSubmit={submit}>
          <label className="block text-sm text-inksoft mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="jsmith"
            required
            className="sp-input mb-1"
          />
          <p className="text-xs text-inkfaint mt-0 mb-4">
            Lowercase letters, numbers, and underscores only. 3–20 characters.
          </p>

          <label className="block text-sm text-inksoft mb-1">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Smith"
            required
            className="sp-input mb-4"
          />

          <label className="block text-sm text-inksoft mb-1">Choose a PIN</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="4–8 digits"
            inputMode="numeric"
            required
            className="sp-input mb-4"
          />

          <label className="block text-sm text-inksoft mb-1">Confirm PIN</label>
          <input
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Re-enter your PIN"
            inputMode="numeric"
            required
            className="sp-input mb-5"
          />

          <button type="submit" disabled={loading} className="sp-btn-primary w-full">
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
        {error && <p className="text-sm mt-3 text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
