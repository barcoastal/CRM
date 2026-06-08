import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SharePageClient } from "./share-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  const share = await prisma.contentShareLink.findUnique({
    where: { token },
    include: {
      document: {
        select: {
          title: true,
          description: true,
          latestVersion: {
            select: { filename: true, contentType: true, byteSize: true, versionNumber: true },
          },
        },
      },
    },
  });

  if (!share) return notFound();

  const expired = share.expiresAt && share.expiresAt.getTime() < Date.now();
  const passwordProtected = !!share.passwordHash;
  const revoked = share.isRevoked;

  const title = share.document.title;
  const description = share.document.description;
  const filename = share.document.latestVersion?.filename ?? "";
  const sizeLabel = share.document.latestVersion
    ? formatBytes(share.document.latestVersion.byteSize)
    : "";

  if (revoked || expired) {
    return (
      <div style={pageWrap}>
        <div style={card}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#080707", marginTop: 0 }}>
            Link unavailable
          </h1>
          <p style={{ fontSize: 14, color: "#3e3e3c" }}>
            {revoked ? "This share link has been revoked." : "This share link has expired."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 4,
              background: "#3052ff",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            FILE
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#080707", margin: 0 }}>{title}</h1>
            <p style={{ fontSize: 12, color: "#706e6b", margin: "4px 0 0" }}>
              {filename}
              {sizeLabel ? ` · ${sizeLabel}` : ""}
            </p>
          </div>
        </div>
        {description && (
          <p style={{ fontSize: 13, color: "#3e3e3c", margin: "0 0 16px" }}>{description}</p>
        )}
        <SharePageClient
          token={token}
          passwordProtected={passwordProtected}
          filename={filename}
        />
      </div>
      <p style={{ marginTop: 16, fontSize: 11, color: "#706e6b" }}>Powered by Coastal CRM</p>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#f3f3f3",
  padding: 24,
  fontFamily: "Salesforce Sans, system-ui, -apple-system, sans-serif",
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: 24,
  width: "min(520px, 100%)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};
