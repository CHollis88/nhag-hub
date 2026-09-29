"use client";

import { useEffect, useState } from "react";
import { FileText, Upload, Trash2, ExternalLink } from "lucide-react";
import { SkeletonRowList } from "./Skeleton";
import EmptyState from "./EmptyState";
import AsyncButton from "./AsyncButton";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";

export default function ProgramDocumentsTab({ groupId, programId, canManage }) {
  const [documents, setDocuments] = useState(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const confirm = useConfirm();
  const run = useAction();

  const baseUrl = `/api/groups/${groupId}/programs/${programId}/documents`;

  const load = async () => {
    try {
      const data = await requestJson(baseUrl);
      setDocuments(data.documents);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  };

  useEffect(() => {
    load();
  }, [baseUrl]);

  // On failure the form keeps the title and the chosen file, so nothing has
  // to be re-entered -- only a success clears it.
  const upload = async () => {
    if (!file || !title.trim()) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    const { ok } = await run(() => requestJson(baseUrl, { method: "POST", body: formData }), { success: "Document uploaded" });
    if (ok) {
      setTitle("");
      setFile(null);
      load();
    }
  };

  const remove = async (doc) => {
    const yes = await confirm({
      title: `Delete "${doc.title}"?`,
      message: "The file is removed for everyone in the ministry.",
      confirmLabel: "Delete document",
    });
    if (!yes) return;
    const { ok } = await run(() => requestJson(`${baseUrl}/${doc.id}`, { method: "DELETE" }), { success: "Document deleted" });
    if (ok) load();
  };

  if (documents === null && loadFailed) {
    return <EmptyState kind="error" text="Couldn't load documents." onRetry={load} />;
  }
  if (documents === null) return <div className="px-5 pt-4"><SkeletonRowList count={3} /></div>;

  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-serif text-xl text-ink mb-4">Documents</h2>

      {canManage && (
        <form onSubmit={(e) => e.preventDefault()} className="sp-card mb-4">
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
          <AsyncButton onClick={upload} savingLabel="Uploading…" disabled={!file || !title.trim()}>
            Upload
          </AsyncButton>
        </form>
      )}

      {documents.length === 0 && (
        <EmptyState icon={FileText} text="No documents uploaded yet." />
      )}

      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="sp-card flex items-center justify-between gap-3">
            <a
              href={`${baseUrl}/${doc.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 min-w-0 flex-1"
            >
              <FileText size={18} className="text-accent flex-shrink-0" />
              <span className="text-sm text-ink truncate">{doc.title}</span>
              <ExternalLink size={12} className="text-inkfaint flex-shrink-0" />
            </a>
            {canManage && (
              <button onClick={() => remove(doc)} className="text-inkfaint flex-shrink-0 p-1" aria-label={`Delete ${doc.title}`}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
