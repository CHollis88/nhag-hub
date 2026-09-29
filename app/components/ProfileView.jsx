"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./ToastProvider";
import { requestJson } from "@/lib/request";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PIN_RE = /^\d{4,8}$/;
const BIO_MAX = 500;

// v71 #29 -- Profile: name, username and bio at the top (every field has a
// visible label, the bio has a character count), and a "Security" section at
// the bottom whose "Change PIN" button opens a small pop-up. The PIN fields
// used to sit in the middle of the profile with placeholders only.
export default function ProfileView({ me, refreshMe, onClose }) {
  const saved = me?.user || {};
  const [displayName, setDisplayName] = useState(saved.display_name || "");
  const [username, setUsername] = useState(saved.username || "");
  const [bio, setBio] = useState(saved.bio || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  const usernameValid = USERNAME_RE.test(username);
  const changed = displayName !== (saved.display_name || "") || username !== (saved.username || "") || bio !== (saved.bio || "");
  const canSave = changed && displayName.trim().length > 0 && usernameValid && !profileBusy;

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setProfileMessage("");
    setProfileBusy(true);
    try {
      await requestJson("/api/me", { method: "PATCH", body: { display_name: displayName, username, bio } });
      setProfileMessage("Saved.");
      refreshMe?.();
    } catch (err) {
      setProfileMessage(err.message); // what was typed stays put
    } finally {
      setProfileBusy(false);
    }
  };

  return (
    <Modal title="Profile" onClose={onClose} z={60} maxHeight="85vh">
      <form onSubmit={saveProfile} className="mb-6">
        <label htmlFor="profile-name" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          Display name
        </label>
        <input
          id="profile-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          className="sp-input mb-3"
        />

        <label htmlFor="profile-username" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          Username
        </label>
        <input
          id="profile-username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={20}
          aria-describedby="profile-username-hint"
          aria-invalid={username && !usernameValid ? true : undefined}
          className="sp-input mb-1"
        />
        <p
          id="profile-username-hint"
          className={`text-xs mt-0 mb-3 ${username && !usernameValid ? "text-red-600 dark:text-red-400" : "text-inkfaint"}`}
        >
          3–20 characters: lowercase letters, numbers and underscores.
        </p>

        <label htmlFor="profile-bio" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          Bio <span className="normal-case tracking-normal">(optional — visible to other members)</span>
        </label>
        <textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={BIO_MAX}
          aria-describedby="profile-bio-count"
          className="sp-textarea mb-1"
        />
        <p id="profile-bio-count" className={`text-xs text-right mt-0 mb-3 ${bio.length >= BIO_MAX ? "text-red-600 dark:text-red-400" : "text-inkfaint"}`}>
          {bio.length} / {BIO_MAX}
        </p>

        <button type="submit" disabled={!canSave} aria-busy={profileBusy || undefined} className="sp-btn-secondary disabled:opacity-60">
          {profileBusy ? "Saving…" : "Save"}
        </button>
        {profileMessage && (
          <p
            role="status"
            className={`text-sm mt-2 ${profileMessage === "Saved." ? "text-sage" : "text-red-600 dark:text-red-400"}`}
          >
            {profileMessage}
          </p>
        )}
      </form>

      <h3 className="text-xs uppercase tracking-wide text-inkfaint mb-2 pb-1 border-b border-linesoft">Security</h3>
      <p className="text-sm text-inksoft mt-0 mb-2">Your PIN is what you use to sign in on this and other devices.</p>
      <button type="button" onClick={() => setPinOpen(true)} className="sp-btn-secondary">
        Change PIN
      </button>

      {pinOpen && <ChangePinDialog onClose={() => setPinOpen(false)} />}
    </Modal>
  );
}

// The pop-up. Everything a PIN needs to be valid is stated up front (not
// revealed after a failed try); the button stays disabled until it is valid;
// a mismatch is called out as you type. On a server error the dialog stays
// open with the reason and what was typed.
function ChangePinDialog({ onClose }) {
  const toast = useToast();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pinValid = PIN_RE.test(pin);
  const mismatch = confirmPin.length > 0 && confirmPin !== pin;
  const canSubmit = pinValid && confirmPin === pin && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/auth/reset-pin", { method: "POST", body: { pin } });
      toast.success("PIN updated");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Change PIN" onClose={onClose} z={70} width="popup" maxHeight="80vh" closeLabel="Cancel">
      <form onSubmit={submit}>
        <p id="pin-rules" className="text-sm text-inksoft mt-0 mb-3">
          Choose a PIN of 4 to 8 digits — numbers only.
        </p>

        <label htmlFor="new-pin" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          New PIN
        </label>
        <input
          id="new-pin"
          data-autofocus=""
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          aria-describedby="pin-rules"
          className="sp-input mb-3 tracking-widest"
        />

        <label htmlFor="confirm-pin" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
          Confirm new PIN
        </label>
        <input
          id="confirm-pin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={8}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
          aria-invalid={mismatch ? true : undefined}
          aria-describedby={mismatch ? "pin-mismatch" : undefined}
          className="sp-input mb-1 tracking-widest"
        />
        <p id="pin-mismatch" role="alert" className="text-sm text-red-600 dark:text-red-400 mt-0 mb-1 min-h-[1.25rem]">
          {mismatch ? "PINs don't match." : ""}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end mt-2">
          <button type="button" onClick={onClose} className="sp-btn-secondary min-h-[44px]">
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit} aria-busy={busy || undefined} className="sp-btn-primary min-h-[44px] disabled:opacity-60">
            {busy ? "Updating…" : "Update PIN"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
