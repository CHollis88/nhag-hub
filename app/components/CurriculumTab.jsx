"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Upload, Trash2 } from "lucide-react";
import { SkeletonList } from "./Skeleton";

// Class-only bolt-on (see RosterTab's Bolt-on Modules and the server-
// side type check in /api/groups/[id]) -- a simple PDF library for a
// Sunday School-style class, mirroring Programs' Documents tab pattern
// but at the ministry level rather than nested under a program.
export default function CurriculumTab({ groupId, canManage }) {
  const [materials, setMaterials] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/curriculum`);
    const data = await res.json();
    if (res.ok) setMaterials(data.materials);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    setBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    const res = await fetch(`/api/groups/${groupId}/curriculum`, { method: "POST", body: formData });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTitle("");
    setDescription("");
    setFile(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this material?")) return;
    await fetch(`/api/groups/${groupId}/curriculum/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-2xl text-ink mb-4">Curriculum</h2>

      {canManage && (
        <form onSubmit={upload} className="sp-card mb-4">
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
          <button type="submit" disabled={busy} className="sp-btn-primary flex items-center gap-1.5">
            <Upload size={14} /> {busy ? "Uploading…" : "Upload"}
          </button>
          {error && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {materials === null && <SkeletonList count={3} />}
      {materials?.length === 0 && <p className="text-sm text-inkfaint">No materials uploaded yet.</p>}
      <div className="space-y-2">
        {materials?.map((m) => (
          <div key={m.id} className="sp-card flex items-start gap-3">
            <FileText size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <a
                href={m.file_url}
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
              <button onClick={() => remove(m.id)} className="text-inkfaint flex-shrink-0" aria-label="Delete">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
