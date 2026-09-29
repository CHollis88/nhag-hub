"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import Image from "next/image";
import Switch from "./Switch";
import { useConfirm } from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { useAction } from "./useAction";
import { readableTextColor } from "@/lib/colorContrast";
import { requestJson } from "@/lib/request";

export const DEFAULT_TILE_COLOR = "#4A5568";

// v71 #35 -- Program settings with ONE explicit Save button.
//
// This panel used to autosave in a mix of ways: the name when you tabbed away
// from it, the colour on every drag of the picker (a request per change), hide
// and the icon the instant you touched them -- so it was never clear what was
// saved. Now every edit here is LOCAL until you press "Save changes", which
// saves them together (name + colour + hidden in one request, then the icon if
// you chose one). "Cancel" throws the edits away. Delete is deliberately not
// part of Save: it is destructive, so it stays its own confirmed action.
export default function ProgramSettingsPanel({ groupId, program, onSaved, onDeleted, onClose, onDirtyChange }) {
  const savedColor = program.tile_color || DEFAULT_TILE_COLOR;
  const [name, setName] = useState(program.name);
  const [color, setColor] = useState(savedColor);
  const [hidden, setHidden] = useState(Boolean(program.hidden));
  const [pendingIcon, setPendingIcon] = useState(null); // a File chosen but not uploaded yet
  const [iconPreview, setIconPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const confirm = useConfirm();
  const toast = useToast();
  const run = useAction();

  const trimmed = name.trim();
  const dirty = trimmed !== program.name || color !== savedColor || hidden !== Boolean(program.hidden) || Boolean(pendingIcon);
  const canSave = dirty && trimmed.length > 0 && !saving;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // A local preview of the chosen icon (nothing is uploaded yet).
  useEffect(() => {
    if (!pendingIcon || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      setIconPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(pendingIcon);
    setIconPreview(url);
    return () => URL.revokeObjectURL?.(url);
  }, [pendingIcon]);

  const chooseIcon = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (file) setPendingIcon(file);
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError("");

    let updated = program;
    const fields = {};
    if (trimmed !== program.name) fields.name = trimmed;
    if (color !== savedColor) fields.tile_color = color;
    if (hidden !== Boolean(program.hidden)) fields.hidden = hidden;

    try {
      // 1. Everything that isn't the icon: ONE request, all-or-nothing.
      if (Object.keys(fields).length) {
        const data = await requestJson(`/api/groups/${groupId}/programs/${program.id}`, { method: "PATCH", body: fields });
        updated = { ...program, ...data.program };
        onSaved(updated);
      }
      // 2. The icon, if one was chosen.
      if (pendingIcon) {
        const formData = new FormData();
        formData.append("file", pendingIcon);
        try {
          const data = await requestJson(`/api/groups/${groupId}/programs/${program.id}/icon`, { method: "POST", body: formData });
          onSaved({ ...updated, image_url: data.image_url });
          setPendingIcon(null);
        } catch (iconErr) {
          // The rest DID save; say so, keep the chosen icon so Save retries it.
          setError(
            Object.keys(fields).length
              ? `Your other changes were saved, but the icon didn't upload: ${iconErr.message}`
              : `The icon didn't upload: ${iconErr.message}`
          );
          return;
        }
      }
      toast.success("Program settings saved");
    } catch (err) {
      setError(err.message); // nothing was saved; everything typed stays put
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (dirty) {
      const yes = await confirm({
        title: "Discard your changes?",
        message: "The changes you haven't saved will be lost.",
        confirmLabel: "Discard changes",
      });
      if (!yes) return;
    }
    onClose();
  };

  const deleteProgram = async () => {
    const yes = await confirm({
      title: `Delete "${program.name}"?`,
      message: "This permanently removes all of its Songs, Setlists, and Documents. This can't be undone.",
      confirmLabel: "Delete program",
    });
    if (!yes) return;
    // Only leaves the screen once it's really gone.
    const { ok } = await run(() => requestJson(`/api/groups/${groupId}/programs/${program.id}`, { method: "DELETE" }), {
      success: `"${program.name}" deleted`,
    });
    if (ok) onDeleted();
  };

  const tileStyle = { background: color, color: readableTextColor(color) };

  return (
    <form onSubmit={save} className="mx-5 sp-card mb-4" aria-labelledby="program-settings-heading">
      <h3 id="program-settings-heading" className="text-xs uppercase tracking-wide text-inkfaint mt-0 mb-3">
        Program settings
      </h3>

      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0">
          {iconPreview ? (
            <img src={iconPreview} alt="Chosen icon (not saved yet)" className="w-14 h-14 rounded-xl object-cover" />
          ) : program.image_url ? (
            <Image src={program.image_url} alt="Current icon" width={56} height={56} className="w-14 h-14 rounded-xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center font-serif text-xl" style={tileStyle} aria-hidden="true">
              {(trimmed || program.name)?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="sp-btn-secondary text-xs py-1.5 px-3 min-h-[44px] inline-flex items-center gap-1.5"
          >
            <Camera size={14} aria-hidden="true" /> {pendingIcon ? "Choose a different icon" : "Change icon"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseIcon} className="hidden" aria-label="Choose an icon image" />
          {pendingIcon && <p className="text-xs text-inkfaint mt-1 mb-0 break-all">{pendingIcon.name} — uploads when you save.</p>}
        </div>
      </div>

      <label htmlFor="program-name" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
        Program name
      </label>
      <input id="program-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!trimmed ? true : undefined} className="sp-input mb-3" />

      <label className="flex items-center gap-3 text-sm text-inksoft mb-2 min-h-[44px]">
        Tile color
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-11 h-9 rounded border border-line" />
      </label>

      <Switch
        checked={hidden}
        onChange={setHidden}
        label="Hide this program from members"
        description="Leaders and admins can still open it. Nothing is deleted."
      />

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2 mb-0">
          {error}
        </p>
      )}
      <p role="status" className="text-xs text-inkfaint mt-2 mb-2 min-h-[1rem]">
        {dirty ? "You have unsaved changes." : ""}
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={cancel} className="sp-btn-secondary flex-1 min-h-[44px]">
          Cancel
        </button>
        <button type="submit" disabled={!canSave} aria-busy={saving || undefined} className="sp-btn-primary flex-1 min-h-[44px] disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-linesoft">
        <button
          type="button"
          onClick={deleteProgram}
          className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 min-h-[44px]"
        >
          <Trash2 size={14} aria-hidden="true" /> Delete this program…
        </button>
      </div>
    </form>
  );
}
