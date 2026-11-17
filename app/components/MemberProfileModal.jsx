"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { useToast } from "./ToastProvider";
import { invalidate } from "@/lib/resourceCache";

// A lightweight, read-only card for viewing another member's
// self-disclosed profile fields. No group-membership check on the
// fetch itself (see the API route) -- bio/location/interests are
// public-by-choice, same as a ministry's leader list already is.
export default function MemberProfileModal({ userId, onClose, canRemovePhoto = false }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const toast = useToast();

  // Church Admins can take down someone's photo (e.g. an inappropriate one).
  const removePhoto = async () => {
    if (!window.confirm(`Remove ${profile?.display_name || "this person"}'s profile photo?`)) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/avatar`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't remove the photo.");
      setProfile((p) => ({ ...p, avatar_url: null }));
      invalidate(() => true); // rosters, directory and posts show the change
      toast.success("Photo removed");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

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
          {profile.avatar_url && (
            <div className="flex justify-center">
              <Avatar url={profile.avatar_url} name={profile.display_name} size={96} />
            </div>
          )}
          {profile.avatar_url && canRemovePhoto && (
            <div className="flex justify-center">
              <button type="button" onClick={removePhoto} disabled={removing} className="text-xs text-red-700 dark:text-red-400 underline disabled:opacity-60">
                {removing ? "Removing…" : "Remove photo (admin)"}
              </button>
            </div>
          )}
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
