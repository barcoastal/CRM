"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadButton } from "@/components/files/upload-button";
import { ShareLinkModal } from "@/components/files/share-link-modal";

interface VersionRow {
  id: string;
  versionNumber: number;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: Date;
  uploadedBy: { id: string; name: string } | null;
}
interface RecordLinkRow {
  id: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  linkedBy: { id: string; name: string } | null;
}
interface ShareRow {
  id: string;
  token: string;
  expiresAt: Date | null;
  passwordHash: string | null;
  downloadCount: number;
  isRevoked: boolean;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
}
interface DocFull {
  id: string;
  title: string;
  description: string | null;
  folder: { id: string; name: string } | null;
  owner: { id: string; name: string; email: string } | null;
  createdAt: Date;
  updatedAt: Date;
  latestVersion: {
    id: string;
    versionNumber: number;
    filename: string;
    contentType: string;
    byteSize: number;
  } | null;
  versions: VersionRow[];
  records: RecordLinkRow[];
  shares: ShareRow[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function entityHref(entityType: string, entityId: string): string {
  const map: Record<string, string> = {
    Lead: `/leads/${entityId}`,
    Opportunity: `/opportunities/${entityId}`,
    Account: `/accounts/${entityId}`,
    Contact: `/contacts/${entityId}`,
    Case: `/cases/${entityId}`,
    Client: `/clients/${entityId}`,
    Creditor: `/creditors/${entityId}`,
    Campaign: `/campaigns/${entityId}`,
    Task: `/tasks/${entityId}`,
    Event: `/events/${entityId}`,
    ProgramPlan: `/program-plans/${entityId}`,
  };
  return map[entityType] ?? "#";
}

export function FileDetail({ doc }: { doc: DocFull }) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);

  async function revokeShare(shareId: string) {
    if (!confirm("Revoke this share link?")) return;
    await fetch(`/api/files/${doc.id}/shares/${shareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRevoked: true }),
    });
    router.refresh();
  }

  async function deleteShare(shareId: string) {
    if (!confirm("Delete this share link permanently?")) return;
    await fetch(`/api/files/${doc.id}/shares/${shareId}`, { method: "DELETE" });
    router.refresh();
  }

  async function unlinkRecord(entityType: string, entityId: string) {
    if (!confirm("Unlink this file from the record?")) return;
    await fetch(`/api/files/${doc.id}/link?entityType=${entityType}&entityId=${entityId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  async function deleteDoc() {
    if (!confirm(`Delete "${doc.title}" and all its versions? This cannot be undone.`)) return;
    const res = await fetch(`/api/files/${doc.id}`, { method: "DELETE" });
    if (res.ok) router.push("/files");
  }

  const isImage = doc.latestVersion?.contentType?.startsWith("image/");
  const isPdf = doc.latestVersion?.contentType === "application/pdf";
  const previewUrl = doc.latestVersion ? `/api/files/${doc.id}/download` : null;

  return (
    <div style={{ padding: "16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, fontSize: 12 }}>
        <Link href="/files" style={{ color: "#3052ff", textDecoration: "none" }}>Files</Link>
        <span style={{ color: "#706e6b" }}>/</span>
        {doc.folder && (
          <>
            <Link href={`/files?folderId=${doc.folder.id}`} style={{ color: "#3052ff", textDecoration: "none" }}>
              {doc.folder.name}
            </Link>
            <span style={{ color: "#706e6b" }}>/</span>
          </>
        )}
        <span style={{ color: "#080707", fontWeight: 600 }}>{doc.title}</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#080707", margin: 0 }}>{doc.title}</h1>
          {doc.description && (
            <p style={{ fontSize: 13, color: "#3e3e3c", marginTop: 6 }}>{doc.description}</p>
          )}
          <p style={{ fontSize: 12, color: "#706e6b", marginTop: 6 }}>
            Owner: {doc.owner?.name ?? "Unowned"} · Created {new Date(doc.createdAt).toLocaleDateString()}
            {doc.latestVersion ? ` · v${doc.latestVersion.versionNumber} · ${formatBytes(doc.latestVersion.byteSize)}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {previewUrl && (
            <a
              href={previewUrl}
              style={{ background: "#fff", border: "1px solid #d8dde6", padding: "6px 14px", borderRadius: 4, textDecoration: "none", color: "#3052ff", fontSize: 13, fontWeight: 600 }}
            >
              Download
            </a>
          )}
          <UploadButton
            endpoint={`/api/files/${doc.id}/versions`}
            buttonLabel="New Version"
          />
          <button
            onClick={() => setShareOpen(true)}
            style={{ background: "#fff", border: "1px solid #d8dde6", padding: "6px 14px", borderRadius: 4, cursor: "pointer", color: "#3052ff", fontSize: 13, fontWeight: 600 }}
          >
            Share
          </button>
          <button
            onClick={deleteDoc}
            style={{ background: "#fff", border: "1px solid #d8dde6", padding: "6px 14px", borderRadius: 4, cursor: "pointer", color: "#c23934", fontSize: 13, fontWeight: 600 }}
          >
            Delete
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 16 }}>
        {/* Preview + versions */}
        <div>
          <section style={{ background: "#fff", border: "1px solid #ecebea", borderRadius: 4, padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 12px" }}>
              Preview
            </h2>
            {!doc.latestVersion ? (
              <p style={{ color: "#706e6b", fontSize: 13 }}>No file uploaded.</p>
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl ?? ""} alt={doc.title} style={{ maxWidth: "100%", maxHeight: 480, display: "block", margin: "0 auto", borderRadius: 4 }} />
            ) : isPdf ? (
              <iframe src={previewUrl ?? ""} style={{ width: "100%", height: 600, border: "1px solid #ecebea", borderRadius: 4 }} />
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "#706e6b", fontSize: 13, background: "#f7f7f7", borderRadius: 4 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#3052ff", marginBottom: 8 }}>FILE</div>
                <div>{doc.latestVersion.filename}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>{doc.latestVersion.contentType}</div>
              </div>
            )}
          </section>

          <section style={{ background: "#fff", border: "1px solid #ecebea", borderRadius: 4, padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 12px" }}>
              Version History ({doc.versions.length})
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafaf9", textAlign: "left" }}>
                  <th style={{ padding: 8, fontWeight: 600, color: "#3e3e3c", borderBottom: "1px solid #ecebea" }}>Version</th>
                  <th style={{ padding: 8, fontWeight: 600, color: "#3e3e3c", borderBottom: "1px solid #ecebea" }}>Filename</th>
                  <th style={{ padding: 8, fontWeight: 600, color: "#3e3e3c", borderBottom: "1px solid #ecebea" }}>Size</th>
                  <th style={{ padding: 8, fontWeight: 600, color: "#3e3e3c", borderBottom: "1px solid #ecebea" }}>Uploaded</th>
                  <th style={{ padding: 8, fontWeight: 600, color: "#3e3e3c", borderBottom: "1px solid #ecebea" }}></th>
                </tr>
              </thead>
              <tbody>
                {doc.versions.map((v) => (
                  <tr key={v.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid #ecebea" }}>v{v.versionNumber}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #ecebea" }}>{v.filename}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #ecebea" }}>{formatBytes(v.byteSize)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #ecebea" }}>
                      {v.uploadedBy?.name ?? "—"} · {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #ecebea" }}>
                      <a href={`/api/files/${doc.id}/download?version=${v.versionNumber}`} style={{ color: "#3052ff", fontSize: 12 }}>
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* Right column — record links + share links */}
        <div>
          <section style={{ background: "#fff", border: "1px solid #ecebea", borderRadius: 4, padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 12px" }}>
              Linked Records ({doc.records.length})
            </h2>
            {doc.records.length === 0 ? (
              <p style={{ color: "#706e6b", fontSize: 12 }}>Not linked to any records yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {doc.records.map((r) => (
                  <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #f7f7f7" }}>
                    <span style={{ fontSize: 11, padding: "2px 6px", background: "#eef2ff", color: "#3052ff", borderRadius: 4, fontWeight: 600 }}>
                      {r.entityType}
                    </span>
                    <Link href={entityHref(r.entityType, r.entityId)} style={{ flex: 1, fontSize: 12, color: "#3052ff", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.entityId}
                    </Link>
                    <button
                      onClick={() => unlinkRecord(r.entityType, r.entityId)}
                      style={{ background: "transparent", border: 0, color: "#c23934", cursor: "pointer", fontSize: 11 }}
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ background: "#fff", border: "1px solid #ecebea", borderRadius: 4, padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 12px" }}>
              Share Links ({doc.shares.length})
            </h2>
            {doc.shares.length === 0 ? (
              <p style={{ color: "#706e6b", fontSize: 12 }}>No share links yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {doc.shares.map((s) => {
                  const expired = s.expiresAt && s.expiresAt.getTime() < Date.now();
                  const url = typeof window !== "undefined" ? `${window.location.origin}/files/share/${s.token}` : `/files/share/${s.token}`;
                  return (
                    <li key={s.id} style={{ padding: "8px 0", borderBottom: "1px solid #f7f7f7" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ flex: 1, fontSize: 11, color: s.isRevoked || expired ? "#706e6b" : "#3e3e3c", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {url}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(url)}
                          style={{ background: "transparent", border: 0, color: "#3052ff", cursor: "pointer", fontSize: 11 }}
                        >
                          Copy
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "#706e6b", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {s.isRevoked && <span style={{ color: "#c23934", fontWeight: 600 }}>REVOKED</span>}
                        {expired && !s.isRevoked && <span style={{ color: "#c23934", fontWeight: 600 }}>EXPIRED</span>}
                        {s.passwordHash && <span>Password</span>}
                        {s.expiresAt && <span>Expires {new Date(s.expiresAt).toLocaleString()}</span>}
                        <span>{s.downloadCount} downloads</span>
                        {!s.isRevoked && (
                          <button
                            onClick={() => revokeShare(s.id)}
                            style={{ background: "transparent", border: 0, color: "#c23934", cursor: "pointer", fontSize: 11, marginLeft: "auto" }}
                          >
                            Revoke
                          </button>
                        )}
                        <button
                          onClick={() => deleteShare(s.id)}
                          style={{ background: "transparent", border: 0, color: "#706e6b", cursor: "pointer", fontSize: 11 }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ShareLinkModal documentId={doc.id} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
