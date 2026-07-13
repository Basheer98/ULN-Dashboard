"use client";

import { useCallback, useEffect, useState } from "react";

interface Attachment {
  id: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  createdAt: string;
}

export function ProjectAttachments({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Attachment | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/projects/${projectId}/attachments`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/v1/projects/${projectId}/attachments`, {
      method: "POST",
      body: form,
    });
    setUploading(false);
    e.target.value = "";
    if (res.ok) load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading photos...</p>;
  }

  return (
    <div className="card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Photos & Attachments</h2>
          <p className="text-xs text-muted-foreground">
            {items.length} file{items.length === 1 ? "" : "s"} from field and office
          </p>
        </div>
        <label className="btn-secondary cursor-pointer text-sm">
          {uploading ? "Uploading..." : "Upload Photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos yet. Fielders can upload from the mobile app.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="group overflow-hidden rounded-lg border border-border bg-surface-elevated text-left transition hover:border-accent/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/v1/files/${encodeURIComponent(item.fileKey)}`}
                alt={item.fileName}
                className="aspect-square w-full object-cover"
              />
              <p className="truncate px-2 py-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/v1/files/${encodeURIComponent(selected.fileKey)}`}
              alt={selected.fileName}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-sm text-muted-foreground">{selected.fileName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
