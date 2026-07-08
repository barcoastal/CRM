import { prisma } from "@/lib/prisma";
import { PublicIntakeForm } from "@/components/upload/public-intake-form";

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

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const req = await prisma.documentRequest.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      recipientName: true,
      kind: true,
      account: {
        select: {
          billingStreet: true,
          billingCity: true,
          billingState: true,
          billingZip: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!req || req.kind !== "INFO") {
    return shell(
      <>
        <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Link not found</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#444444" }}>
          This link is not valid. Please contact your representative for a new one.
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
          For security, this link is no longer active. Please contact your representative for a new
          one.
        </p>
      </>,
    );
  }

  const first = (req.recipientName ?? "").split(" ")[0];
  return shell(
    <>
      <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#181818" }}>Confirm your information</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "#444444" }}>
        {first ? `Hi ${first}, ` : ""}please review and fill in your mailing address and contact
        details below, then submit. Add anything else we should know at the bottom.
      </p>
      <PublicIntakeForm
        token={token}
        initial={{
          street: req.account?.billingStreet ?? "",
          city: req.account?.billingCity ?? "",
          state: req.account?.billingState ?? "",
          zip: req.account?.billingZip ?? "",
          phone: req.account?.phone ?? "",
          email: req.account?.email ?? "",
        }}
      />
    </>,
  );
}
