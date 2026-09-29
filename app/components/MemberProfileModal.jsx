"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

// A lightweight, read-only card for viewing another member's
// self-disclosed profile fields. No group-membership check on the
// fetch itself (see the API route) -- bio/location/interests are
// public-by-choice, same as a ministry's leader list already is.
export default function MemberProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${userId}/profile`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.profile) setProfile(data.profile);
        else setError(data.error || "Couldn't load profile.");
      })
      .catch(() => !cancelled && setError("Couldn't reach the server."));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <Modal title={profile?.display_name || "Profile"} onClose={onClose} z={70} maxHeight="70vh">
      {!profile && !error && <p className="text-sm text-inkfaint">Loading…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {profile && (
        <div className="space-y-3">
          {profile.bio ? (
            <p className="text-sm text-inksoft whitespace-pre-wrap">{profile.bio}</p>
          ) : (
            <p className="text-sm text-inkfaint italic">No bio yet.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
