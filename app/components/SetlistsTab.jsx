"use client";

import { useState } from "react";
import { useFormDisclosure } from "./useFormDisclosure";
import { Plus, Trash2, Pencil, PlayCircle } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import EmptyState from "./EmptyState";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { STALE, invalidate } from "@/lib/resourceCache";
import { useScrollMemory } from "@/lib/useScreenState";
import SetlistForm from "./SetlistForm";
import MediaViewerModal from "./MediaViewerModal";
import { SONG_MEDIA_FIELDS } from "@/lib/songMedia";

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SetlistsTab({ groupId, canManage, baseUrl, songsUrl }) {
  const [editing, setEditing] = useState(null);
  // v71 #36: ONE form at a time (new OR editing one setlist), "Add" turns into
  // "Cancel" while it's open, focus lands on the first field, and comes back to
  // what opened it when it closes.
  const form = useFormDisclosure(editing?.id ?? "new");
  const showForm = form.open && !editing;
  const openNew = () => {
    setEditing(null);
    form.show();
  };
  const openEdit = (setlist, fromElement) => {
    setEditing(setlist);
    form.show(fromElement);
  };
  const closeForm = () => {
    setEditing(null);
    form.hide();
  };
  // The full linked song object + which field to open on first render --
  // MediaViewerModal is the exact same full-screen viewer Songs uses,
  // so opening it here (as an overlay on top of this screen) and
  // closing it naturally lands right back on the setlist, with no
  // separate navigation/back-button plumbing needed.
  const [viewer, setViewer] = useState(null);

  // Same reuse pattern as SongsTab: defaults to the group's own
  // setlists URL so Choir's existing Setlists tab is unaffected;
  // Programs passes its own program-scoped URLs (see ProgramsTab.jsx).
  const url = baseUrl || `/api/groups/${groupId}/setlists`;
  const songLibraryUrl = songsUrl || `/api/groups/${groupId}/songs`;

  const confirm = useConfirm();
  const run = useAction();

  // v71 #42-45: through the shared cache. The song picker reads the SAME entry
  // the Songs screen uses, so if you've just been on Songs it costs no request.
  const setlistsKey = `group:${groupId}:${url}`;
  const { data: setlists, error: setlistsError, refresh: load } = useResource(
    setlistsKey,
    async () => (await requestJson(url)).setlists,
    { staleMs: STALE.list }
  );
  const loadFailed = Boolean(setlistsError);
  const { data: songsData } = useResource(`group:${groupId}:${songLibraryUrl}`, async () => (await requestJson(songLibraryUrl)).songs, {
    staleMs: STALE.list,
  });
  const songs = songsData || [];
  const scrollAnchor = useScrollMemory(`setlists:${url}`, setlists !== null);
  const reload = () => invalidate(setlistsKey);

  // The form hands back the whole intended song list (with notes, in
  // order) in one go, matching the real Choir app's UX -- reorder/add/
  // remove/edit-note all happen locally in the form, then get saved as
  // one action.
  //
  // v71 #9: that one action is now ONE request and ONE database transaction
  // (save_setlist / save_program_setlist, migration_034) -- create is a
  // POST with the songs in the body, edit is a PUT. Before, a save was a
  // header update plus a delete per song plus an add per song, and a
  // failure partway left the setlist half-empty. Now a failure changes
  // nothing, and the form stays open with everything still typed in.
  // Both return { ok } so the form knows whether to close.
  const create = async ({ service_date, service, songs: entries, notify }) => {
    const result = await run(
      () => requestJson(url, { method: "POST", body: { service_date, service, notify, songs: entries } }),
      { success: "Setlist posted" }
    );
    if (result.ok) {
      closeForm();
      reload();
    }
    return result;
  };

  const saveEdit = async ({ service_date, service, songs: entries }) => {
    const result = await run(
      () => requestJson(`${url}/${editing.id}`, { method: "PUT", body: { service_date, service, songs: entries } }),
      { success: "Setlist saved" }
    );
    if (result.ok) {
      closeForm();
      reload();
    }
    return result;
  };

  const remove = async (s) => {
    const yes = await confirm({
      title: `Delete the ${s.service} setlist for ${fmtDate(s.service_date)}?`,
      message: "The songs stay in the library; only this setlist is removed.",
      confirmLabel: "Delete setlist",
    });
    if (!yes) return;
    const { ok } = await run(() => requestJson(`${url}/${s.id}`, { method: "DELETE" }), { success: "Setlist deleted" });
    if (ok) reload();
  };

  if (setlists === null && loadFailed) return <EmptyState kind="error" text="Couldn't load setlists." onRetry={load} />;
  if (setlists === null) return <div className="px-5 pt-4"><SkeletonList count={3} /></div>;

  return (
    <div className="px-5 pt-4 pb-6">
      <div ref={scrollAnchor} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl text-ink">Setlists</h2>
        {canManage && (
          <button ref={form.triggerRef} onClick={() => (form.open ? closeForm() : openNew())} className="sp-btn-pill">
            {form.open ? (
              "Cancel"
            ) : (
              <>
                <Plus size={14} aria-hidden="true" /> Add
              </>
            )}
          </button>
        )}
      </div>

      {showForm && <SetlistForm formRef={form.formRef} allSongs={songs} onCancel={closeForm} onSave={create} />}
      {editing && (
        <SetlistForm
          key={editing.id}
          formRef={form.formRef}
          initial={editing}
          allSongs={songs}
          onCancel={closeForm}
          onSave={saveEdit}
        />
      )}

      {setlists.length === 0 && !form.open && (
        <EmptyState icon={PlayCircle} text="No setlists posted yet." action={{ label: "Add a setlist", onClick: openNew }} canAct={canManage} />
      )}

      <div className="space-y-3">
        {setlists.map((s) => (
          <div key={s.id} className="sp-card relative">
            <div className="flex items-center justify-between mb-2 pr-14">
              <p className="font-serif text-lg text-ink">{fmtDate(s.service_date)}</p>
              <span className="text-[0.625rem] uppercase tracking-wide bg-navy/10 text-navy dark:bg-blue-400/15 dark:text-blue-300 rounded-full px-2 py-0.5 font-semibold">
                {s.service}
              </span>
            </div>
            {s.songs.length === 0 ? (
              <p className="text-sm text-inkfaint">No songs added yet.</p>
            ) : (
              <ol className="space-y-2">
                {s.songs.map((song, i) => {
                  const linkedSong = song.group_songs || song.program_songs;
                  const available = linkedSong
                    ? SONG_MEDIA_FIELDS.filter(([key]) => linkedSong[key])
                    : [];
                  return (
                    <li key={song.id} className="text-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="text-inkfaint w-4 flex-shrink-0">{i + 1}.</span>
                        <span className="text-ink flex-1">{linkedSong?.title}</span>
                        {song.note && <span className="text-inkfaint text-xs">{song.note}</span>}
                      </div>
                      {/* One button, not a pill per link -- tapping it opens the
                          same full-screen viewer Songs uses, which already
                          shows every link this song has as its own pill up
                          top, so nothing here needs to enumerate them itself. */}
                      {available.length > 0 && (
                        <button
                          onClick={() => setViewer({ song: linkedSong, field: available[0][0] })}
                          className="ml-6 mt-1 inline-flex items-center gap-1.5 text-xs text-accent"
                        >
                          <PlayCircle size={14} /> View media
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {canManage && (
              <div className="absolute top-4 right-4 flex items-center gap-3">
                <button onClick={(e) => openEdit(s, e.currentTarget)} data-return-focus={`setlist-edit-${s.id}`} className="text-inkfaint p-1" aria-label={`Edit ${s.service} setlist`}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(s)} className="text-inkfaint p-1" aria-label={`Delete ${s.service} setlist`}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {viewer && (
        <MediaViewerModal song={viewer.song} initialField={viewer.field} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
