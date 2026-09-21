"use client";

import { useState } from "react";

export default function ProfileView({ me, refreshMe, onClose }) {
  const [displayName, setDisplayName] = useState(me?.user?.display_name || "");
  const [username, setUsername] = useState(me?.user?.username || "");
  const [bio, setBio] = useState(me?.user?.bio || "");
  const [location, setLocation] = useState(me?.user?.location || "");
  const [interests, setInterests] = useState(me?.user?.interests || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileBusy(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, username, bio, location, interests }),
    });
    const data = await res.json();
    setProfileBusy(false);
    if (!res.ok) {
      setProfileMessage(data.error);
      return;
    }
    setProfileMessage("Saved.");
    refreshMe?.();
  };

  const changePin = async (e) => {
    e.preventDefault();
    setPinMessage("");
    if (newPin !== confirmNewPin) {
      setPinMessage("PINs don't match.");
      return;
    }
    const res = await fetch("/api/auth/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: newPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPinMessage(data.error);
      return;
    }
    setNewPin("");
    setConfirmNewPin("");
    setPinMessage("PIN updated.");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-4 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">Profile</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
        </div>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Name &amp; Username</p>
        <form onSubmit={saveProfile} className="mb-5">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="sp-input mb-2"
          />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="username"
            className="sp-input mb-2"
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short bio — visible to other members (optional)"
            rows={3}
            maxLength={500}
            className="sp-textarea mb-2"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            maxLength={100}
            className="sp-input mb-2"
          />
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="Interests (optional)"
            maxLength={300}
            className="sp-input mb-2"
          />
          <button type="submit" disabled={profileBusy} className="sp-btn-secondary">
            {profileBusy ? "Saving…" : "Save"}
          </button>
          {profileMessage && (
            <p
              className={`text-sm mt-2 ${
                profileMessage === "Saved." ? "text-sage" : "text-red-600 dark:text-red-400"
              }`}
            >
              {profileMessage}
            </p>
          )}
        </form>

        <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Change PIN</p>
        <form onSubmit={changePin} className="mb-2">
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            placeholder="New PIN (4–8 digits)"
            inputMode="numeric"
            className="sp-input mb-2"
          />
          <input
            value={confirmNewPin}
            onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Confirm new PIN"
            inputMode="numeric"
            className="sp-input mb-2"
          />
          <button type="submit" className="sp-btn-secondary">Update PIN</button>
          {pinMessage && <p className="text-sm text-inksoft mt-2">{pinMessage}</p>}
        </form>
      </div>
    </div>
  );
}
