"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";
import { UploadButton } from "@/components/files/upload-button";

interface FolderLite {
  id: string;
  name: string;
  parentId: string | null;
}
interface FolderWithCount extends FolderLite {
  _count: { files: number; children: number };
}
interface DocRow {
  id: string;
  title: string;
  description: string | null;
  updatedAt: Date;
  createdAt: Date;
  latestVersion: {
    filename: string;
    contentType: string;
    byteSize: number;
    versionNumber: number;
  } | null;
  owner: { id: string; name: string } | null;
  _count: { versions: number; records: number; shares: number };
}

function fileIcon(ct: string | undefined): string {
  if (!ct) return "FILE";
  if (ct.startsWith("image/")) return "IMG";
  if (ct === "application/pdf") return "PDF";
  if (ct.includes("spreadsheet") || ct === "text/csv") return "XLS";
  if (ct.includes("word")) return "DOC";
  if (ct.startsWith("text/")) return "TXT";
  return "FILE";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FilesBrowser({
  currentFolder,
  folders,
  allFolders,
  docs,
  q,
}: {
  currentFolder: FolderLite | null;
  folders: FolderWithCount[];
  allFolders: FolderLite[];
  docs: DocRow[];
  q: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Build folder tree for sidebar
  const byParent = useMemo(() => {
    const m = new Map<string | null, FolderLite[]>();
    for (const f of allFolders) {
      const k = f.parentId ?? null;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return m;
  }, [allFolders]);

  function goToFolder(id: string | null) {
    const p = new URLSearchParams(searchParams);
    if (id) p.set("folderId", id);
    else p.delete("folderId");
    router.push(`/files?${p.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams(searchParams);
    if (search) p.set("q", search);
    else p.delete("q");
    router.push(`/files?${p.toString()}`);
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    const res = await fetch("/api/files/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim(), parentId: currentFolder?.id ?? null }),
    });
    if (res.ok) {
      setNewFolderOpen(false);
      setNewFolderName("");
      router.refresh();
    }
  }

  return (
    <div style={{ padding: "16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#080707", margin: 0, flex: 1 }}>
          Files
        </h1>
        <UploadButton folderId={currentFolder?.id ?? null} buttonLabel="Upload" />
        <button
          onClick={() => setNewFolderOpen(true)}
          style={{
            background: "#fff",
            border: "1px solid #d8dde6",
            padding: "6px 14px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#3052ff",
          }}
        >
          + New Folder
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        {/* Sidebar — folder tree */}
        <aside
          style={{
            background: "#fff",
            border: "1px solid #ecebea",
            borderRadius: 4,
            padding: 12,
            alignSelf: "start",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Folders
          </div>
          <FolderTree
            byParent={byParent}
            parentId={null}
            level={0}
            currentId={currentFolder?.id ?? null}
            onGo={goToFolder}
          />
        </aside>

        {/* Main content */}
        <main style={{ background: "#fff", border: "1px solid #ecebea", borderRadius: 4, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <Breadcrumb folder={currentFolder} allFolders={allFolders} onGo={goToFolder} />
            <form onSubmit={submitSearch} style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files..."
                style={{
                  padding: "6px 10px",
                  border: "1px solid #d8dde6",
                  borderRadius: 4,
                  fontSize: 13,
                  minWidth: 220,
                }}
              />
              <button
                type="submit"
                style={{ background: "#3052ff", color: "#fff", border: 0, padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
              >
                Search
              </button>
            </form>
          </div>

          {/* Subfolders */}
          {folders.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
                Subfolders
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => goToFolder(f.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      border: "1px solid #ecebea",
                      borderRadius: 4,
                      textAlign: "left",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        background: "#eef2ff",
                        color: "#3052ff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      DIR
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#080707", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#706e6b" }}>
                        {f._count.files} files{f._count.children ? `, ${f._count.children} subfolders` : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Files ({docs.length})
          </div>
          {docs.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#706e6b", fontSize: 13 }}>
              No files here yet. Click Upload to add one.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {docs.map((d) => (
                <Link
                  key={d.id}
                  href={`/files/${d.id}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    border: "1px solid #ecebea",
                    borderRadius: 4,
                    padding: 12,
                    textDecoration: "none",
                    color: "inherit",
                    background: "#fff",
                    transition: "box-shadow .12s",
                  }}
                  className="sf-file-card"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 4,
                        background: "#3052ff",
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      {fileIcon(d.latestVersion?.contentType)}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#080707", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#706e6b" }}>
                        {d.latestVersion ? formatBytes(d.latestVersion.byteSize) : ""}
                        {d.latestVersion ? ` · v${d.latestVersion.versionNumber}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#706e6b" }}>
                    {d.owner?.name ?? "Unowned"} · {new Date(d.updatedAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 11, color: "#3e3e3c" }}>
                    {d._count.records > 0 && <span>{d._count.records} linked</span>}
                    {d._count.shares > 0 && <span>{d._count.shares} shared</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>

      {newFolderOpen && (
        <div
          onClick={() => setNewFolderOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 4, width: "min(420px, 100%)", margin: 16 }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #d8dde6" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#080707", margin: 0 }}>New Folder</h2>
            </div>
            <div style={{ padding: 20 }}>
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                onKeyDown={(e) => e.key === "Enter" && createFolder()}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d8dde6", borderRadius: 4, fontSize: 13 }}
              />
              {currentFolder && (
                <p style={{ fontSize: 11, color: "#706e6b", marginTop: 8 }}>
                  Inside: {currentFolder.name}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  onClick={() => setNewFolderOpen(false)}
                  style={{ background: "#fff", border: "1px solid #d8dde6", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  style={{ background: "#3052ff", color: "#fff", border: 0, padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.sf-file-card:hover) { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      `}</style>
    </div>
  );
}

function FolderTree({
  byParent,
  parentId,
  level,
  currentId,
  onGo,
}: {
  byParent: Map<string | null, FolderLite[]>;
  parentId: string | null;
  level: number;
  currentId: string | null;
  onGo: (id: string | null) => void;
}) {
  const children = byParent.get(parentId) ?? [];
  return (
    <div>
      {level === 0 && (
        <button
          onClick={() => onGo(null)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "6px 8px",
            background: currentId === null ? "#eef2ff" : "transparent",
            color: currentId === null ? "#3052ff" : "#3e3e3c",
            border: 0,
            cursor: "pointer",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          All Files
        </button>
      )}
      {children.map((f) => (
        <div key={f.id}>
          <button
            onClick={() => onGo(f.id)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              paddingLeft: 8 + level * 12,
              background: currentId === f.id ? "#eef2ff" : "transparent",
              color: currentId === f.id ? "#3052ff" : "#3e3e3c",
              border: 0,
              cursor: "pointer",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            {f.name}
          </button>
          <FolderTree byParent={byParent} parentId={f.id} level={level + 1} currentId={currentId} onGo={onGo} />
        </div>
      ))}
    </div>
  );
}

function Breadcrumb({
  folder,
  allFolders,
  onGo,
}: {
  folder: FolderLite | null;
  allFolders: FolderLite[];
  onGo: (id: string | null) => void;
}) {
  if (!folder) {
    return (
      <span style={{ fontSize: 13, color: "#080707", fontWeight: 600 }}>All Files</span>
    );
  }
  const map = new Map(allFolders.map((f) => [f.id, f]));
  const chain: FolderLite[] = [];
  let cur: FolderLite | undefined = folder;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#3e3e3c" }}>
      <button onClick={() => onGo(null)} style={{ background: "transparent", border: 0, color: "#3052ff", cursor: "pointer", padding: 0, fontSize: 13 }}>
        All Files
      </button>
      {chain.map((c) => (
        <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#706e6b" }}>/</span>
          {c.id === folder.id ? (
            <span style={{ fontWeight: 600, color: "#080707" }}>{c.name}</span>
          ) : (
            <button onClick={() => onGo(c.id)} style={{ background: "transparent", border: 0, color: "#3052ff", cursor: "pointer", padding: 0, fontSize: 13 }}>
              {c.name}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
