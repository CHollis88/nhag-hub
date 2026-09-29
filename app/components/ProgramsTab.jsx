"use client";

import { useState } from "react";
import { Plus, ChevronLeft, Music, ListMusic, FileText, Settings } from "lucide-react";
import Image from "next/image";
import { SkeletonList } from "./Skeleton";
import TabTransition from "./TabTransition";
import { readableTextColor } from "@/lib/colorContrast";
import SongsTab from "./SongsTab";
import SetlistsTab from "./SetlistsTab";
import ProgramDocumentsTab from "./ProgramDocumentsTab";
import EmptyState from "./EmptyState";
import { useConfirm } from "./ConfirmDialog";
import ProgramSettingsPanel, { DEFAULT_TILE_COLOR } from "./ProgramSettingsPanel";
import { useFormDisclosure } from "./useFormDisclosure";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { STALE, invalidate } from "@/lib/resourceCache";

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
  const [settingsDirty, setSettingsDirty] = useState(false);
  const confirm = useConfirm();
  const color = program.tile_color || DEFAULT_TILE_COLOR;

  // Leaving with unsaved settings edits asks first (v71 #35: edits are local
  // until "Save changes").
  const confirmDiscard = async () => {
    if (!settingsDirty) return true;
    return confirm({
      title: "Discard your changes?",
      message: "The program settings you haven't saved will be lost.",
      confirmLabel: "Discard changes",
    });
  };
  const toggleSettings = async () => {
    if (settingsOpen && !(await confirmDiscard())) return;
    setSettingsOpen((o) => !o);
  };
  const goBack = async () => {
    if (!(await confirmDiscard())) return;
    onBack();
  };

  return (
    <div>
      <div className="px-5 pt-4 flex items-center justify-between mb-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-accent min-h-[44px]">
          <ChevronLeft size={16} /> Programs
        </button>
        {canManage && (
          <button
            onClick={toggleSettings}
            className="text-inkfaint min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Program settings"
            aria-expanded={settingsOpen}
          >
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
        <ProgramSettingsPanel
          groupId={groupId}
          program={program}
          onSaved={onUpdated}
          onDeleted={onBack}
          onClose={() => setSettingsOpen(false)}
          onDirtyChange={setSettingsDirty}
        />
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
  const [openProgram, setOpenProgram] = useState(null);
  const createForm = useFormDisclosure();
  const showCreateForm = createForm.open;
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  // v71 #42-45: the programs list comes through the shared cache; coming back
  // from inside a program shows it at once instead of a blank skeleton.
  const programsKey = `group:${groupId}:programs`;
  const { data: programs, error: programsError, refresh: load } = useResource(
    programsKey,
    async () => (await requestJson(`/api/groups/${groupId}/programs`)).programs,
    { staleMs: STALE.list }
  );
  const loadFailed = Boolean(programsError);
  const reload = () => invalidate(programsKey);

  const createProgram = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError("");
    try {
      await requestJson(`/api/groups/${groupId}/programs`, { method: "POST", body: { name: newName.trim() } });
    } catch (err) {
      setError(err.message); // the name stays typed
      return;
    }
    setNewName("");
    createForm.hide();
    reload();
  };

  const handleProgramUpdated = (updated) => {
    setOpenProgram(updated);
    reload();
  };

  if (programs === null && loadFailed) return <EmptyState kind="error" text="Couldn't load programs." onRetry={load} />;
  if (programs === null) return <div className="px-5 pt-4"><SkeletonList count={3} /></div>;

  if (openProgram) {
    return (
      <ProgramShell
        groupId={groupId}
        program={openProgram}
        canManage={canManage}
        onBack={() => {
          setOpenProgram(null);
          reload();
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
          <button
            ref={createForm.triggerRef}
            onClick={() => (createForm.open ? createForm.hide() : createForm.show())}
            className="sp-btn-pill"
          >
            {createForm.open ? (
              "Cancel"
            ) : (
              <>
                <Plus size={14} aria-hidden="true" /> New Program
              </>
            )}
          </button>
        )}
      </div>

      {showCreateForm && (
        <form ref={createForm.formRef} onSubmit={createProgram} className="sp-card mb-4" aria-labelledby="new-program-heading">
          <h3 id="new-program-heading" className="font-serif text-lg text-ink mt-0 mb-3">New program</h3>
          <label htmlFor="new-program-name" className="block text-xs uppercase tracking-wide text-inkfaint mb-1">Program name</label>
          <input
            id="new-program-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Christmas Cantata"
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
