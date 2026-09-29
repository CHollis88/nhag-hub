"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Upload, Trash2 } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import EmptyState from "./EmptyState";
import AsyncButton from "./AsyncButton";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";

// Class-only bolt-on (see RosterTab's Bolt-on Modules and the server-
// side type check in /api/groups/[id]) -- a simple PDF library for a
// Sunday School-style class, mirroring Programs' Documents tab pattern
// but at the ministry level rather than nested under a program.
export default function CurriculumTab({ groupId, canManage }) {
  const [materials, setMaterials] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const confirm = useConfirm();
  const run = useAction();

  const load = useCallback(async () => {
    try {
      const data = await requestJson(`/api/groups/${groupId}/curriculum`);
      setMaterials(data.materials);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // On failure the form keeps everything typed and the chosen file; only a
  // success clears it.
  const upload = async () => {
    if (!file || !title.trim()) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    const { ok } = await run(
      () => requestJson(`/api/groups/${groupId}/curriculum`, { method: "POST", body: formData }),
      { success: "Material uploaded" }
    );
    if (ok) {
      setTitle("");
      setDescription("");
      setFile(null);
      load();
    }
  };

  const remove = async (m) => {
    const yes = await confirm({
      title: `Delete "${m.title}"?`,
      message: "The file is removed for everyone in the class.",
      confirmLabel: "Delete material",
    });
    if (!yes) return;
    const { ok } = await run(
      () => requestJson(`/api/groups/${groupId}/curriculum/${m.id}`, { method: "DELETE" }),
      { success: "Material deleted" }
    );
    if (ok) load();
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Curriculum</h2>

      {canManage && (
        <form onSubmit={(e) => e.preventDefault()} className="sp-card mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Week 3 handout)"
            required
            className="sp-input mb-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="sp-textarea mb-2"
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
            className="sp-input mb-2"
          />
          <AsyncButton onClick={upload} savingLabel="Uploading…" disabled={!file || !title.trim()} className="sp-btn-primary flex items-center gap-1.5">
            <Upload size={14} /> Upload
          </AsyncButton>
        </form>
      )}

      {materials === null && loadFailed && <EmptyState kind="error" text="Couldn't load materials." onRetry={load} />}
      {materials === null && !loadFailed && <SkeletonList count={3} />}
      {materials?.length === 0 && <EmptyState icon={FileText} text="No materials uploaded yet." />}
      <div className="space-y-2">
        {materials?.map((m) => (
          <div key={m.id} className="sp-card flex items-start gap-3">
            <FileText size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <a
                href={`/api/groups/${groupId}/curriculum/${m.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink hover:underline block truncate"
              >
                {m.title}
              </a>
              {m.description && <p className="text-sm text-inksoft mt-0.5">{m.description}</p>}
              <p className="text-xs text-inkfaint mt-1">
                {m.users?.display_name && `${m.users.display_name} · `}
                {new Date(m.created_at).toLocaleDateString()}
              </p>
            </div>
            {canManage && (
              <button onClick={() => remove(m)} className="text-inkfaint flex-shrink-0 p-1" aria-label={`Delete ${m.title}`}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
