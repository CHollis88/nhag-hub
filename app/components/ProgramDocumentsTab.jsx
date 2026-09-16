"use client";

import { useEffect, useState } from "react";
import { FileText, Upload, Trash2, ExternalLink } from "lucide-react";
import { SkeletonRowList } from "./Skeleton";

export default function ProgramDocumentsTab({ groupId, programId, canManage }) {
  const [documents, setDocuments] = useState(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const baseUrl = `/api/groups/${groupId}/programs/${programId}/documents`;

  const load = async () => {
    const res = await fetch(baseUrl);
    const data = await res.json();
    if (res.ok) setDocuments(data.documents);
  };

  useEffect(() => {
    load();
  }, [baseUrl]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError("");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    const res = await fetch(baseUrl, { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTitle("");
    setFile(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this document?")) return;
    await fetch(`${baseUrl}/${id}`, { method: "DELETE" });
    load();
  };

  if (documents === null) return <div className="px-5 pt-4"><SkeletonRowList count={3} /></div>;

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-xl text-ink mb-4">Documents</h2>

      {canManage && (
        <form onSubmit={upload} className="sp-card mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="sp-input mb-2"
          />
          <label className="flex items-center gap-2 text-sm text-inksoft border border-line rounded-lg px-3 py-2.5 mb-2 cursor-pointer">
            <Upload size={16} className="text-inkfaint flex-shrink-0" />
            {file ? file.name : "Choose a PDF..."}
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          <button type="submit" disabled={uploading || !file || !title.trim()} className="sp-btn-primary">
            {uploading ? "Uploading…" : "Upload"}
          </button>
          {error && <p className="text-sm mt-2 text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}

      {documents.length === 0 && (
        <p className="text-sm text-inkfaint text-center py-6">No documents uploaded yet.</p>
      )}

      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="sp-card flex items-center justify-between gap-3">
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 min-w-0 flex-1"
            >
              <FileText size={18} className="text-accent flex-shrink-0" />
              <span className="text-sm text-ink truncate">{doc.title}</span>
              <ExternalLink size={12} className="text-inkfaint flex-shrink-0" />
            </a>
            {canManage && (
              <button onClick={() => remove(doc.id)} className="text-inkfaint flex-shrink-0" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
