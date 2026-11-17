"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import Avatar from "./Avatar";
import { useToast } from "./ToastProvider";
import { requestJson } from "@/lib/request";

const SIZE = 320; // stored as a 320x320 square: sharp on any phone, about 20 KB

// Crops the middle square of the picked picture and shrinks it on the phone,
// so only a small file is ever uploaded (whatever size the original was).
async function shrinkToSquare(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't a picture this phone can open."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    const blob =
      (await new Promise((r) => canvas.toBlob(r, "image/webp", 0.85))) ||
      (await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85))); // older iPhones can't make WebP
    if (!blob) throw new Error("Couldn't prepare that picture.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Profile > photo: add, change or remove your own.
export default function ProfilePhoto({ me, refreshMe }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(me?.user?.avatar_url || null);
  const name = me?.user?.display_name || "";

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await shrinkToSquare(file);
      const form = new FormData();
      form.append("file", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
      const res = await fetch("/api/me/avatar", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save your photo.");
      setUrl(data.avatar_url);
      toast.success("Photo saved");
      refreshMe?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await requestJson("/api/me/avatar", { method: "DELETE" });
      setUrl(null);
      toast.success("Photo removed");
      refreshMe?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4 mb-5">
      <div className="relative">
        <Avatar url={url} name={name} size={72} />
        {busy && <span className="absolute inset-0 rounded-full bg-black/30 animate-pulse motion-reduce:animate-none" aria-hidden="true" />}
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" aria-hidden="true" tabIndex={-1} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="sp-btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-60">
          <Camera size={14} aria-hidden="true" /> {url ? "Change photo" : "Add a photo"}
        </button>
        {url && (
          <button type="button" onClick={remove} disabled={busy} className="text-xs text-inkfaint underline disabled:opacity-60">
            Remove photo
          </button>
        )}
        <p className="text-xs text-inkfaint m-0">Shown next to your name around the app.</p>
      </div>
    </div>
  );
}
