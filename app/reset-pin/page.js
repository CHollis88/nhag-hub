"use client";

import { useState } from "react";

// Reached only via a magic-link recovery click -- see /api/auth/verify.
// The person has just proven email ownership, so this is allowed to set
// a brand new PIN outright with no old-PIN confirmation needed.
export default function ResetPinPage() {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
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
      const res = await fetch("/api/auth/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setDone(true);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-navydeep">
        <div className="max-w-[420px] w-full p-8 rounded-2xl bg-card text-center">
          <h2 className="font-serif text-xl text-ink mb-2">PIN updated</h2>
          <p className="text-sm text-inksoft mb-4">
            You can sign in with your new PIN now — including going straight to the app on your
            phone if you have it installed. You don't need to open this email link again.
          </p>
          <a href="/" className="sp-btn-primary inline-block">Continue</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-navydeep">
      <div className="max-w-[420px] w-full p-8 rounded-2xl bg-card">
        <h2 className="font-serif text-xl text-ink mb-1">Set a new PIN</h2>
        <p className="text-sm text-inkfaint mb-5">
          This replaces your old PIN. Use it to sign in anywhere from now on.
        </p>
        <form onSubmit={submit}>
          <label className="block text-sm text-inksoft mb-1">New PIN</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="4–8 digits"
            inputMode="numeric"
            required
            className="sp-input mb-4"
          />
          <label className="block text-sm text-inksoft mb-1">Confirm new PIN</label>
          <input
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Re-enter your new PIN"
            inputMode="numeric"
            required
            className="sp-input mb-5"
          />
          <button type="submit" disabled={loading} className="sp-btn-primary w-full">
            {loading ? "Saving…" : "Set new PIN"}
          </button>
        </form>
        {error && <p className="text-sm mt-3 text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
