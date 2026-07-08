import { prisma } from "@/lib/prisma";
import { PublicUploader } from "@/components/upload/public-uploader";

export const dynamic = "force-dynamic";

function shell(children: React.ReactNode) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6f9",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 16px",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 8,
          padding: 32,
        }}
      >
        {children}
        <p style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#747474" }}>
          Coastal Debt Resolve
        </p>
      </div>
    </div>
  );
}

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const req = await prisma.documentRequest.findUnique({
    where: { token },
    select: { status: true, expiresAt: true, recipientName: true },
  });

  if (!req) {
    return shell(
      <>
        <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Link not found</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#444444" }}>
          This upload link is not valid. Please contact your representative for a new one.
        </p>
      </>,
    );
  }

  const expired = req.status === "CANCELLED" || (req.expiresAt && req.expiresAt.getTime() < Date.now());
  if (expired) {
    return shell(
      <>
        <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>This link has expired</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#444444" }}>
          For security, this upload link is no longer active. Please contact your representative for
          a new one.
        </p>
      </>,
    );
  }

  const first = (req.recipientName ?? "").split(" ")[0];
  return shell(
    <>
      <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#181818" }}>Upload your documents</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "#444444" }}>
        {first ? `Hi ${first}, ` : ""}drop your files below or choose them from your device. You can
        upload as many as you need. We will be notified automatically once they come in.
      </p>
      <PublicUploader token={token} />
    </>,
  );
}
