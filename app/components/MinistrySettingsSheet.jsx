"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { PLAN_LIST } from "@/lib/planRegistry";
import { readableTextColor } from "@/lib/colorContrast";
import GroupProgressView from "./GroupProgressView";
import Modal from "./Modal";
import Switch from "./Switch";
import { useAction } from "./useAction";
import { requestJson, errorMessage } from "@/lib/request";

// v71 #33 -- everything about how a ministry looks and which modules it has,
// behind a "Ministry settings" button on the Roster (it used to sit inline
// above the member list and push the members off the screen). Only opened for
// someone who can manage the ministry, so no extra permission check here.
// The module switches are stored on/off settings, so they are Switches (#34);
// leaders can change their own ministry's modules (decision L).
export default function MinistrySettingsSheet({ groupId, onRenamed, onClose }) {
  const [group, setGroup] = useState(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#8B1E2F");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [progressViewOpen, setProgressViewOpen] = useState(false);
  const fileInputRef = useRef(null);
  const run = useAction();

  const load = useCallback(async () => {
    try {
      const data = await requestJson(`/api/groups/${groupId}`);
      setGroup(data.group);
      setName(data.group.name);
      setType(data.group.type || "");
      setDescription(data.group.description || "");
      setColor(data.group.tile_color || "#8B1E2F");
    } catch (err) {
      setMessage(errorMessage(err, "Couldn't load this ministry's settings."));
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // Every toggle below is optimistic, and is put back (with the server's
  // reason) if the save fails -- before, a rejected change just sat there
  // looking saved until the next reload.
  const saveColor = async (newColor) => {
    const before = color;
    setColor(newColor);
    const { ok } = await run(() => requestJson(`/api/groups/${groupId}`, { method: "PATCH", body: { tile_color: newColor } }));
    if (!ok) setColor(before);
  };

  const saveNameAndType = async (e) => {
    e.preventDefault();
    setMessage("");
    const trimmedName = name.trim();
    if (!trimmedName) return;
    // Stays as typed on failure; the reason shows right under the form.
    try {
      await requestJson(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: { name: trimmedName, type: type.trim(), description: description.trim() },
      });
    } catch (err) {
      setMessage(err.message);
      return;
    }
    setMessage("Saved.");
    onRenamed?.(trimmedName);
  };

  const savePlanLock = async (locked, planId) => {
    const before = { reading_plan_locked: group.reading_plan_locked, reading_plan_id: group.reading_plan_id };
    setGroup((g) => ({ ...g, reading_plan_locked: locked, reading_plan_id: planId }));
    const { ok } = await run(() =>
      requestJson(`/api/groups/${groupId}`, { method: "PATCH", body: { reading_plan_locked: locked, reading_plan_id: planId } })
    );
    if (!ok) setGroup((g) => ({ ...g, ...before }));
  };

  const toggleFeature = async (key) => {
    const current = group.features || [];
    const next = current.includes(key) ? current.filter((f) => f !== key) : [...current, key];
    setGroup((g) => ({ ...g, features: next }));
    const { ok } = await run(() => requestJson(`/api/groups/${groupId}`, { method: "PATCH", body: { features: next } }));
    if (!ok) setGroup((g) => ({ ...g, features: current }));
  };

  const uploadIcon = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await requestJson(`/api/groups/${groupId}/icon`, { method: "POST", body: formData });
      load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploading(false);
      e.target.value = ""; // lets the same file be picked again after a failure
    }
  };

  const features = group?.features || [];

  return (
    <Modal title="Ministry settings" onClose={onClose} z={50} maxHeight="85vh">
      {!group && !message && <p className="text-sm text-inkfaint">Loading…</p>}
      {!group && message && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {message}
        </p>
      )}
      {group && (
        <>
          <h3 className="text-xs uppercase tracking-wide text-inkfaint mt-0 mb-3 pb-1 border-b border-linesoft">Appearance</h3>
          <div className="flex items-center gap-4 mb-3">
            {group.image_url ? (
              <Image src={group.image_url} alt="" width={64} height={64} className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center font-serif text-2xl"
                style={{ background: color, color: readableTextColor(color) }}
              >
                {group.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="sp-btn-secondary text-xs py-1.5 px-3 mb-2 min-h-[44px]">
                {uploading ? "Uploading…" : "Change icon"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadIcon} className="hidden" aria-label="Choose an icon image" />
              <label className="flex items-center gap-2 text-sm text-inksoft">
                Tile color
                <input type="color" value={color} onChange={(e) => saveColor(e.target.value)} className="w-11 h-9 rounded border border-line" />
              </label>
            </div>
          </div>
          <form onSubmit={saveNameAndType} className="space-y-3">
            <div>
              <label htmlFor="ministry-name" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">Ministry name</label>
              <input id="ministry-name" value={name} onChange={(e) => setName(e.target.value)} className="sp-input" />
            </div>
            <div>
              <label htmlFor="ministry-type" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
                Type / category <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input id="ministry-type" value={type} onChange={(e) => setType(e.target.value)} className="sp-input" />
            </div>
            <div>
              <label htmlFor="ministry-description" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">
                What is this ministry? <span className="normal-case tracking-normal">(shown to people considering joining)</span>
              </label>
              <textarea id="ministry-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="sp-textarea" />
            </div>
            <button type="submit" disabled={!name.trim()} className="sp-btn-secondary disabled:opacity-60">Save</button>
          </form>
          {message && (
            <p role="status" className={`text-sm mt-2 ${message === "Saved." ? "text-sage" : "text-red-600 dark:text-red-400"}`}>
              {message}
            </p>
          )}

          <h3 className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-1 pb-1 border-b border-linesoft">Bolt-on modules</h3>
          <p className="text-xs text-inkfaint mt-1 mb-1">Turning a module off hides it. Nothing in it is deleted.</p>
          {[
            ["songs_setlists", "Song library + Setlists (Choir-style)"],
            ["programs", "Programs (Songs / Setlist / Documents per program)"],
            ["reading_plan_journal", "Bible Plan (Today / Plan / Journal)"],
            ["direct_messages", "Messages (member to leader, private)"],
            ["chat_members", "Chat — Members channel"],
            ["chat_leaders", "Chat — Leaders Only channel"],
            ...(group.type?.toLowerCase().includes("class") ? [["curriculum", "Curriculum (class materials, PDF)"]] : []),
          ].map(([key, label]) => (
            <Switch key={key} checked={features.includes(key)} onChange={() => toggleFeature(key)} label={label} />
          ))}

          {features.includes("reading_plan_journal") && (
            <>
              <h3 className="text-xs uppercase tracking-wide text-inkfaint mt-6 mb-1 pb-1 border-b border-linesoft">Reading plan</h3>
              <Switch
                checked={Boolean(group.reading_plan_locked)}
                onChange={(next) => savePlanLock(next, group.reading_plan_id || "foundations")}
                label="Lock everyone in this group onto one plan together"
                description={
                  group.reading_plan_locked
                    ? "Everyone in this group follows the plan below."
                    : "Unlocked — each member picks their own plan from the same list."
                }
              />
              {group.reading_plan_locked && (
                <>
                  <label htmlFor="ministry-plan" className="sr-only">Reading plan for this group</label>
                  <select id="ministry-plan" value={group.reading_plan_id} onChange={(e) => savePlanLock(true, e.target.value)} className="sp-input">
                    {PLAN_LIST.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.totalDays} days)
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button onClick={() => setProgressViewOpen(true)} className="text-sm text-accent underline mt-3 block min-h-[44px]">
                View group progress
              </button>
              {progressViewOpen && <GroupProgressView groupId={groupId} onClose={() => setProgressViewOpen(false)} />}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
