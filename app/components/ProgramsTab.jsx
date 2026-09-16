"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, ChevronLeft, Music, ListMusic, FileText, Settings, EyeOff, Eye, Trash2, Camera } from "lucide-react";
import Image from "next/image";
import { SkeletonList } from "./Skeleton";
import TabTransition from "./TabTransition";
import { readableTextColor } from "@/lib/colorContrast";
import SongsTab from "./SongsTab";
import SetlistsTab from "./SetlistsTab";
import ProgramDocumentsTab from "./ProgramDocumentsTab";

const DEFAULT_TILE_COLOR = "#4A5568";
const SUB_TABS = [
  { key: "songs", label: "Songs", icon: Music },
  { key: "setlist", label: "Setlist", icon: ListMusic },
  { key: "documents", label: "Documents", icon: FileText },
];

// A program's mini-shell: opened by tapping its card. Mirrors the same
// "own contextual nav" idea as GroupShell itself, just one level
// deeper -- its Songs/Setlist/Documents are genuinely its own content
// (separate program_songs/program_setlists/program_documents tables,
// per Cam's explicit answer that a program's library is NOT shared with
// the ministry's main Songs tab), not a filtered view of the parent
// group's.
function ProgramShell({ groupId, program, canManage, onBack, onUpdated }) {
  const [subTab, setSubTab] = useState("songs");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState(program.name);
  const [color, setColor] = useState(program.tile_color || DEFAULT_TILE_COLOR);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const patch = async (fields) => {
    const res = await fetch(`/api/groups/${groupId}/programs/${program.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (res.ok) onUpdated(data.program);
    return res.ok;
  };

  const saveName = async () => {
    if (!name.trim() || name.trim() === program.name) return;
    await patch({ name: name.trim() });
  };

  const saveColor = async (c) => {
    setColor(c);
    await patch({ tile_color: c });
  };

  const toggleHidden = async () => {
    await patch({ hidden: !program.hidden });
  };

  const uploadIcon = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/groups/${groupId}/programs/${program.id}/icon`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploading(false);
    if (res.ok) onUpdated({ ...program, image_url: data.image_url });
  };

  const deleteProgram = async () => {
    if (!confirm(`Delete "${program.name}"? This removes all of its Songs, Setlists, and Documents. This can't be undone.`)) return;
    await fetch(`/api/groups/${groupId}/programs/${program.id}`, { method: "DELETE" });
    onBack();
  };

  return (
    <div>
      <div className="px-5 pt-4 flex items-center justify-between mb-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-accent">
          <ChevronLeft size={16} /> Programs
        </button>
        {canManage && (
          <button onClick={() => setSettingsOpen((s) => !s)} className="text-inkfaint" aria-label="Program settings">
            <Settings size={18} />
          </button>
        )}
      </div>

      <div className="px-5 flex items-center gap-3 mb-4">
        {program.image_url ? (
          <Image src={program.image_url} alt="" width={48} height={48} className="w-12 h-12 rounded-xl object-cover" />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-serif text-xl flex-shrink-0"
            style={{ background: color, color: readableTextColor(color) }}
          >
            {program.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <h2 className="font-serif text-2xl text-ink">{program.name}</h2>
        {program.hidden && (
          <span className="text-[0.625rem] uppercase tracking-wide bg-inkfaint/20 text-inkfaint rounded-full px-2 py-0.5 font-semibold">
            Hidden
          </span>
        )}
      </div>

      {canManage && settingsOpen && (
        <div className="mx-5 sp-card mb-4">
          <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">Program settings</p>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-10 h-10 rounded-lg border border-line flex items-center justify-center text-inkfaint flex-shrink-0"
              aria-label="Change icon"
            >
              <Camera size={16} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadIcon} className="hidden" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              className="sp-input flex-1"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => saveColor(e.target.value)}
              className="w-10 h-8 rounded border border-line flex-shrink-0"
            />
          </div>
          <div className="flex items-center justify-between">
            <button onClick={toggleHidden} className="flex items-center gap-1.5 text-xs text-inksoft">
              {program.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
              {program.hidden ? "Unhide this program" : "Hide this program"}
            </button>
            <button onClick={deleteProgram} className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}

      <div className="px-5 flex gap-2 mb-2 flex-wrap">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-1.5 ${
              subTab === key ? "bg-accent text-white" : "bg-paper text-inkfaint border border-line"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <TabTransition tabKey={subTab}>
        {subTab === "songs" && (
          <SongsTab
            groupId={groupId}
            canManage={canManage}
            baseUrl={`/api/groups/${groupId}/programs/${program.id}/songs`}
          />
        )}
        {subTab === "setlist" && (
          <SetlistsTab
            groupId={groupId}
            canManage={canManage}
            baseUrl={`/api/groups/${groupId}/programs/${program.id}/setlists`}
            songsUrl={`/api/groups/${groupId}/programs/${program.id}/songs`}
          />
        )}
        {subTab === "documents" && (
          <ProgramDocumentsTab groupId={groupId} programId={program.id} canManage={canManage} />
        )}
      </TabTransition>
    </div>
  );
}

export default function ProgramsTab({ groupId, canManage }) {
  const [programs, setPrograms] = useState(null);
  const [openProgram, setOpenProgram] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/groups/${groupId}/programs`);
    const data = await res.json();
    if (res.ok) setPrograms(data.programs);
  };

  useEffect(() => {
    load();
  }, [groupId]);

  const createProgram = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    const res = await fetch(`/api/groups/${groupId}/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setNewName("");
    setShowCreateForm(false);
    load();
  };

  const handleProgramUpdated = (updated) => {
    setOpenProgram(updated);
    load();
  };

  if (programs === null) return <div className="px-5 pt-4"><SkeletonList count={3} /></div>;

  if (openProgram) {
    return (
      <ProgramShell
        groupId={groupId}
        program={openProgram}
        canManage={canManage}
        onBack={() => {
          setOpenProgram(null);
          load();
        }}
        onUpdated={handleProgramUpdated}
      />
    );
  }

  return (
    <div className="px-5 pt-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Programs</h2>
        {canManage && (
          <button onClick={() => setShowCreateForm((s) => !s)} className="sp-btn-pill">
            <Plus size={14} /> New Program
          </button>
        )}
      </div>

      {showCreateForm && (
        <form onSubmit={createProgram} className="sp-card mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Program name (e.g. Christmas Cantata)"
            required
            className="sp-input mb-2"
          />
          <button type="submit" className="sp-btn-primary">Create</button>
          {error && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {programs.length === 0 && !showCreateForm && (
        <p className="text-sm text-inkfaint text-center py-6">No programs yet.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] md:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
        {programs.map((p) => {
          const bg = p.tile_color || DEFAULT_TILE_COLOR;
          return (
            <button
              key={p.id}
              onClick={() => setOpenProgram(p)}
              className="sp-card p-0 overflow-hidden flex flex-col items-center text-center relative"
            >
              {p.hidden && (
                <span className="absolute top-2 right-2 text-[0.5625rem] uppercase tracking-wide bg-inkfaint/20 text-inkfaint rounded-full px-1.5 py-0.5 font-semibold">
                  Hidden
                </span>
              )}
              <div className="h-2 w-full flex-shrink-0" style={{ background: bg }} />
              <div className="p-4 flex flex-col items-center">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt=""
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 mb-2"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center font-serif text-xl mb-2"
                    style={{ background: bg, color: readableTextColor(bg) }}
                  >
                    {p.name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <p className="font-serif text-sm text-ink leading-snug break-words">{p.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
