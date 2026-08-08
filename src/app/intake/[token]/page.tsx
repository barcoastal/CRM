import { prisma } from "@/lib/prisma";
import { PublicIntakeForm } from "@/components/upload/public-intake-form";

export const dynamic = "force-dynamic";

function shell(children: React.ReactNode) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F2F4F9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 16px",
        fontFamily:
          "'Aeonik','Helvetica Neue',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          border: "1px solid #e4e8f5",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "22px 32px",
            borderBottom: "1px solid #eef1f8",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/email/coastal-logo.png" alt="Coastal Debt Resolve" style={{ width: 170, height: "auto" }} />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 14,
              background: "#eaf5ec",
              color: "#2e844a",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#2e844a" aria-hidden="true">
              <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
            </svg>
            Secure form
          </span>
        </div>
        <div style={{ padding: 32 }}>{children}</div>
      </div>
      <div style={{ width: "100%", maxWidth: 560, padding: "18px 8px 0", textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
          &#128274; Your information is encrypted in transit with bank-level SSL security and used
          only to service your file. It is never shared or sold.
        </p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#1a1a2e" }}>
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
      requestedFields: true,
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

  // Which sections the agent asked for. Legacy requests (null) = address only.
  const VALID = ["address", "ssn", "ein", "dob", "debts", "bank"] as const;
  let requested: (typeof VALID)[number][] = ["address"];
  if (req.requestedFields) {
    try {
      const parsed = JSON.parse(req.requestedFields) as unknown;
      if (Array.isArray(parsed)) {
        const filtered = VALID.filter((k) => parsed.includes(k));
        if (filtered.length) requested = filtered;
      }
    } catch {
      // keep the address-only default
    }
  }
  const SECTION_LABELS: Record<(typeof VALID)[number], string> = {
    address: "your mailing address and contact details",
    ssn: "your Social Security Number",
    ein: "your business EIN / Tax ID",
    dob: "your date of birth",
    debts: "your current debts (lender and amount)",
    bank: "your bank details",
  };
  const asked = requested.map((k) => SECTION_LABELS[k]);
  const askedText =
    asked.length === 1 ? asked[0] : `${asked.slice(0, -1).join(", ")} and ${asked[asked.length - 1]}`;

  const first = (req.recipientName ?? "").split(" ")[0];
  return shell(
    <>
      <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#181818" }}>Confirm your information</h1>
      <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "#444444" }}>
        {first ? `Hi ${first}, ` : ""}please fill in {askedText} below, then submit. Add anything
        else we should know at the bottom.
      </p>
      <PublicIntakeForm
        token={token}
        requested={requested}
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
