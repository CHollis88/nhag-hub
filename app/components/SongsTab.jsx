"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Trash2, Pencil } from "lucide-react";
import { SkeletonRowList } from "./Skeleton";
import SongForm from "./SongForm";
import { useFormDisclosure } from "./useFormDisclosure";
import MediaViewerModal from "./MediaViewerModal";
import EmptyState from "./EmptyState";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { STALE, invalidate } from "@/lib/resourceCache";
import { useScreenState, useScrollMemory } from "@/lib/useScreenState";
import { SONG_MEDIA_FIELDS } from "@/lib/songMedia";

function SongRow({ baseUrl, song, canManage, onUpdated, editing, onEdit, onCloseEdit, formRef }) {
  const [open, setOpen] = useState(false);
  const [viewerField, setViewerField] = useState(null);
  const confirm = useConfirm();
  const run = useAction();

  const availableLinks = SONG_MEDIA_FIELDS.filter(([key]) => song[key]);

  // The form stays open, with everything typed, unless this really saved.
  const saveEdit = async (fields) => {
    const result = await run(() => requestJson(`${baseUrl}/${song.id}`, { method: "PATCH", body: fields }), {
      success: "Song saved",
    });
    if (result.ok) {
      onCloseEdit();
      onUpdated();
    }
    return result;
  };

  const remove = async () => {
    const yes = await confirm({
      title: `Delete "${song.title}"?`,
      message: "It will also be removed from any setlists it's in. This can't be undone.",
      confirmLabel: "Delete song",
    });
    if (!yes) return;
    const { ok } = await run(() => requestJson(`${baseUrl}/${song.id}`, { method: "DELETE" }), { success: "Song deleted" });
    if (ok) onUpdated();
  };

  if (editing) {
    return <SongForm formRef={formRef} initial={song} onCancel={onCloseEdit} onSave={saveEdit} />;
  }

  return (
    <div className="border border-line rounded-xl overflow-hidden bg-card">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="font-serif text-base text-ink truncate">{song.title}</p>
          {song.composer && <p className="text-xs text-inkfaint truncate">{song.composer}</p>}
        </div>
      </button>

      {open && (
        <div className="border-t border-linesoft px-4 py-3">
          {availableLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {availableLinks.map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setViewerField(key)}
                  className="inline-flex items-center gap-1.5 text-xs bg-accent/8 text-accent rounded-full px-3 py-1.5"
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-inkfaint mb-2">Nothing linked yet for this song.</p>
          )}

          {song.notes && <p className="text-sm text-inksoft mb-2">{song.notes}</p>}

          {canManage && (
            <div className="flex gap-3 pt-1">
              <button onClick={(e) => onEdit(song.id, e.currentTarget)} data-return-focus={`song-edit-${song.id}`} className="text-xs text-inkfaint flex items-center gap-1">
                <Pencil size={12} /> Edit
              </button>
              <button onClick={remove} className="text-xs text-inkfaint flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {viewerField && (
        <MediaViewerModal song={song} initialField={viewerField} onClose={() => setViewerField(null)} />
      )}
    </div>
  );
}

export default function SongsTab({ groupId, canManage, baseUrl }) {
  // v71 #42-45: the song list comes through the shared cache (Setlists uses the
  // same entry for its song picker, so opening it after Songs costs no request);
  // the search text and scroll position are remembered.
  // v71 #36: ONE form at a time -- adding a song OR editing one -- with "Add"
  // becoming "Cancel", focus on the first field, and focus returned afterwards.
  const [editingId, setEditingId] = useState(null);
  const form = useFormDisclosure(editingId ?? "new");
  const showForm = form.open && !editingId;
  const closeForm = () => {
    setEditingId(null);
    form.hide();
  };

  // Defaults to the group's own song library URL so every existing
  // caller (Choir's Songs tab) behaves exactly as before -- Programs
  // passes its own program-scoped URL instead (see ProgramsTab.jsx),
  // reusing this same well-tested list/search/edit UI rather than
  // forking it, since a program's song library is a separate table but
  // an identical shape and behavior.
  const url = baseUrl || `/api/groups/${groupId}/songs`;

  const run = useAction();
  const songsKey = `group:${groupId}:${url}`;
  const { data: songs, error: songsError, refresh: load } = useResource(songsKey, async () => (await requestJson(url)).songs, {
    staleMs: STALE.list,
  });
  const loadFailed = Boolean(songsError);
  const [query, setQuery] = useScreenState(`songs:${url}:query`, "");
  const scrollAnchor = useScrollMemory(`songs:${url}`, songs !== null);
  // After a change: this list refreshes, and setlists (which embed songs, and
  // lose a deleted one) go stale too.
  const reload = () => {
    invalidate(songsKey);
    invalidate((k) => k.startsWith(`group:${groupId}:`) && k.includes("/setlists"));
  };

  const filtered = useMemo(() => {
    if (!songs) return [];
    if (!query.trim()) return songs;
    const q = query.toLowerCase();
    return songs.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.composer && s.composer.toLowerCase().includes(q))
    );
  }, [songs, query]);

  // The form stays open, with everything typed, unless this really saved.
  const create = async (fields) => {
    const result = await run(() => requestJson(url, { method: "POST", body: fields }), { success: "Song added" });
    if (result.ok) {
      closeForm();
      reload();
    }
    return result;
  };

  if (songs === null && loadFailed) return <EmptyState kind="error" text="Couldn't load songs." onRetry={load} />;
  if (songs === null) return <div className="px-5 pt-4"><SkeletonRowList count={5} /></div>;

  return (
    <div className="px-5 pt-4 pb-6">
      <div ref={scrollAnchor} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl text-ink">Songs</h2>
        {canManage && (
          <button
            ref={form.triggerRef}
            onClick={() => {
              if (form.open) closeForm();
              else form.show();
            }}
            className="sp-btn-pill"
          >
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

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or composer..."
          className="sp-input pl-9"
        />
      </div>

      {showForm && <SongForm formRef={form.formRef} onCancel={closeForm} onSave={create} />}

      {filtered.length === 0 && !form.open && (
        <p className="text-sm text-inkfaint text-center py-6">
          {query ? "No songs match that search." : "No songs yet."}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map((song) => (
          <SongRow
            key={song.id}
            baseUrl={url}
            song={song}
            canManage={canManage}
            onUpdated={reload}
            editing={editingId === song.id}
            onEdit={(id, fromElement) => {
              setEditingId(id);
              form.show(fromElement);
            }}
            onCloseEdit={closeForm}
            formRef={form.formRef}
          />
        ))}
      </div>

      {!query && songs.length > 0 && (
        <p className="text-[0.6875rem] text-inkfaint text-center mt-4">{songs.length} songs in the library</p>
      )}
    </div>
  );
}
