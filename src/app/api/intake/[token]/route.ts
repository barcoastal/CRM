import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendESignEmail } from "@/lib/esign/send-email";
import { appBaseUrl } from "@/lib/document-request";
import { normalizeUsState } from "@/lib/us-states";

// Public (no-login) endpoint for INFO requests. The token is the only secret.

async function loadRequest(token: string) {
  return prisma.documentRequest.findUnique({
    where: { token },
    select: {
      id: true,
      kind: true,
      status: true,
      expiresAt: true,
      recipientName: true,
      opportunityId: true,
      accountId: true,
      createdById: true,
    },
  });
}

function liveState(req: { status: string; expiresAt: Date | null }): "OK" | "EXPIRED" | "CLOSED" {
  if (req.status === "CANCELLED") return "CLOSED";
  if (req.expiresAt && req.expiresAt.getTime() < Date.now()) return "EXPIRED";
  return "OK";
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const req = await loadRequest(token);
  if (!req || req.kind !== "INFO") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const state = liveState(req);
  if (state !== "OK") return NextResponse.json({ error: state.toLowerCase() }, { status: 410 });

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const digits = (v: unknown, len: number): string => {
    const d = typeof v === "string" ? v.replace(/\D/g, "") : "";
    return d.length === len ? d : "";
  };
  const money = (v: unknown): number | null => {
    const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const rawDebts = Array.isArray(b.debts) ? (b.debts as Array<Record<string, unknown>>) : [];
  const info = {
    street: str(b.street),
    city: str(b.city),
    // US-only: store the 2-letter state code ("Hawaii"/"hi" -> "HI").
    state: normalizeUsState(str(b.state, 40)) || str(b.state, 2).toUpperCase(),
    zip: str(b.zip, 20),
    phone: str(b.phone, 40),
    email: str(b.email, 200),
    notes: str(b.notes, 4000),
  };
  const ssn = digits(b.ssn, 9);
  const ein = digits(b.ein, 9);
  const dobStr = str(b.dob, 10);
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(dobStr) ? new Date(`${dobStr}T00:00:00Z`) : null;
  const debts = rawDebts
    .map((d) => ({ lender: str(d.lender, 200), amount: money(d.amount) }))
    .filter((d) => d.lender && d.amount != null)
    .slice(0, 30) as Array<{ lender: string; amount: number }>;
  const rawBank = (b.bank ?? {}) as Record<string, unknown>;
  const bank = {
    name: str(rawBank.name, 120),
    routing: digits(rawBank.routing, 9),
    account: (() => {
      const d = typeof rawBank.account === "string" ? rawBank.account.replace(/\D/g, "") : "";
      return d.length >= 4 && d.length <= 17 ? d : "";
    })(),
    accountType: str(rawBank.accountType, 20) === "Savings" ? "Savings" : "Checking",
  };
  const hasBank = !!(bank.name || bank.routing || bank.account);
  const ssnMasked = ssn ? `XXX-XX-${ssn.slice(-4)}` : "";
  const einFmt = ein ? `${ein.slice(0, 2)}-${ein.slice(2)}` : "";

  // Save the address + contact onto the Account (only overwrite when provided).
  // This is THE storage the contract packet reads (buildContractData pulls
  // ClientAddress/City/State/Zip from Account billing fields).
  const data: Record<string, string> = {};
  if (info.street) data.billingStreet = info.street;
  if (info.city) data.billingCity = info.city;
  if (info.state) data.billingState = info.state;
  if (info.zip) data.billingZip = info.zip;
  if (info.phone) data.phone = info.phone;
  if (info.email) data.email = info.email;
  if (ein) data.ein = ein;
  if (bank.name) data.bankName = bank.name;
  if (bank.routing) data.bankRoutingNumber = bank.routing;
  if (bank.account) {
    data.bankAccountNumber = bank.account;
    data.bankAccountType = bank.accountType;
  }
  if (ssn) {
    data.ssn = ssn;
    data.ssnLast4 = ssn.slice(-4);
  }

  if (req.accountId) {
    if (Object.keys(data).length) {
      await prisma.account.update({ where: { id: req.accountId }, data }).catch(() => undefined);
    }
  } else if (req.opportunityId && Object.keys(data).length) {
    // Lead-based deal with no Account yet: create the Client account from the
    // submitted info and link it to the opportunity, so contracts (and the SF
    // parity screens) have a real billing address to pull.
    const opp = await prisma.opportunity.findUnique({
      where: { id: req.opportunityId },
      select: {
        id: true,
        accountId: true,
        name: true,
        lead: { select: { businessName: true, contactName: true } },
      },
    });
    if (opp) {
      if (opp.accountId) {
        await prisma.account.update({ where: { id: opp.accountId }, data }).catch(() => undefined);
      } else {
        const acctName =
          opp.lead?.businessName?.trim() ||
          req.recipientName?.trim() ||
          opp.lead?.contactName?.trim() ||
          opp.name ||
          "New Client";
        const acct = await prisma.account
          .create({ data: { name: acctName, recordType: "CLIENT", ...data } })
          .catch(() => null);
        if (acct) {
          await prisma.opportunity
            .update({ where: { id: opp.id }, data: { accountId: acct.id } })
            .catch(() => undefined);
        }
      }
    }
  }

  // Reload the request row: the account may have just been created above.
  const fresh = await prisma.documentRequest.findUnique({
    where: { id: req.id },
    select: {
      accountId: true,
      opportunityId: true,
      opportunity: { select: { accountId: true, primaryContactId: true } },
    },
  });
  const effAccountId = fresh?.accountId ?? fresh?.opportunity?.accountId ?? null;

  // Mirror person-level fields onto the Contact (primary contact of the
  // opportunity, else the account's primary contact).
  let contactId =
    fresh?.opportunity?.primaryContactId ??
    (effAccountId
      ? (
          await prisma.account.findUnique({
            where: { id: effAccountId },
            select: { primaryContactId: true },
          })
        )?.primaryContactId ?? null
      : null);

  const cData: Record<string, unknown> = {};
  if (ssn) cData.ssn = ssn;
  if (dob) cData.birthdate = dob;
  if (info.street) cData.mailingStreet = info.street;
  if (info.city) cData.mailingCity = info.city;
  if (info.state) cData.mailingState = info.state;
  if (info.zip) cData.mailingZip = info.zip;
  if (info.phone) cData.phone = info.phone;
  if (info.email) cData.email = info.email;

  if (!contactId && Object.keys(cData).length && req.recipientName?.trim()) {
    // No contact on the deal yet: create one from the recipient so the
    // person-level data (SSN, birthdate, mailing address) has a home, and
    // link it as primary on both the opportunity and the account.
    const parts = req.recipientName.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || firstName;
    const created = await prisma.contact
      .create({
        data: {
          firstName,
          lastName,
          fullName: req.recipientName.trim(),
          primaryAccountId: effAccountId,
          ...cData,
        },
      })
      .catch(() => null);
    if (created) {
      contactId = created.id;
      if (effAccountId) {
        // Also create the relation row so the contact shows in the
        // Contacts tab lists on the account and opportunity.
        await prisma.accountContactRelation
          .upsert({
            where: { accountId_contactId: { accountId: effAccountId, contactId: created.id } },
            create: { accountId: effAccountId, contactId: created.id, role: "Primary Contact" },
            update: {},
          })
          .catch(() => undefined);
      }
      if (req.opportunityId) {
        await prisma.opportunity
          .update({ where: { id: req.opportunityId }, data: { primaryContactId: created.id } })
          .catch(() => undefined);
      }
      if (effAccountId) {
        await prisma.account
          .update({ where: { id: effAccountId }, data: { primaryContactId: created.id } })
          .catch(() => undefined);
      }
    }
  } else if (contactId && Object.keys(cData).length) {
    await prisma.contact.update({ where: { id: contactId }, data: cData }).catch(() => undefined);
  }

  // Mirror phone/email onto the Opportunity record fields the opp Details
  // page displays (oppPhone/oppEmail).
  if (req.opportunityId && (info.phone || info.email)) {
    const oData: Record<string, string> = {};
    if (info.phone) oData.oppPhone = info.phone;
    if (info.email) oData.oppEmail = info.email;
    await prisma.opportunity
      .update({ where: { id: req.opportunityId }, data: oData })
      .catch(() => undefined);
  }

  // Debt rows land on the opportunity (Debt Information tab + totals).
  if (debts.length && req.opportunityId) {
    await prisma.debt
      .createMany({
        data: debts.map((d) => ({
          opportunityId: req.opportunityId,
          creditorName: d.lender,
          originalBalance: d.amount,
          currentBalance: d.amount,
          enrolledBalance: d.amount,
          status: "ENROLLED",
        })),
      })
      .catch(() => undefined);
    // Refresh the opp debt rollups so Total Debt reflects what the client listed.
    const sum = await prisma.debt.aggregate({
      where: { opportunityId: req.opportunityId },
      _sum: { originalBalance: true },
    });
    const totalDebt = sum._sum.originalBalance ?? null;
    if (totalDebt != null) {
      await prisma.opportunity
        .update({
          where: { id: req.opportunityId },
          data: { totalDebt, currentTotalDebt: totalDebt },
        })
        .catch(() => undefined);
    }
  }

  // Log everything the client submitted as a NOTE task on the opp + account so
  // it shows in the activity timeline (and the free-text "anything else").
  // SSN is masked here; the full value lives only in the dedicated columns.
  const addrLine = [info.street, info.city, info.state, info.zip].filter(Boolean).join(", ");
  const noteBody = [
    addrLine && `Address: ${addrLine}`,
    info.phone && `Phone: ${info.phone}`,
    info.email && `Email: ${info.email}`,
    ssnMasked && `SSN: ${ssnMasked}`,
    einFmt && `EIN/TIN: ${einFmt}`,
    hasBank && `Bank: ${[bank.name, bank.accountType, bank.routing && `routing ${bank.routing}`, bank.account && `account ...${bank.account.slice(-4)}`].filter(Boolean).join(", ")}`,
    dob && `Date of birth: ${dobStr}`,
    ...debts.map((d) => `Debt: ${d.lender} - $${d.amount.toLocaleString()}`),
    info.notes && `Notes: ${info.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  await prisma.task
    .create({
      data: {
        recordType: "ACTIVITY",
        type: "NOTE",
        status: "COMPLETED",
        completedAt: new Date(),
        subject: `Client submitted info${req.recipientName ? ` - ${req.recipientName}` : ""}`,
        notes: noteBody || "(no fields filled)",
        ownerId: req.createdById,
        opportunityId: req.opportunityId ?? null,
        accountId: req.accountId ?? null,
      },
    })
    .catch(() => undefined);

  await prisma.documentRequest.update({
    where: { id: req.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      // Snapshot keeps the SSN masked; full values live in the record columns.
      collectedJson: {
        ...info,
        ssn: ssnMasked || undefined,
        ein: einFmt || undefined,
        dob: dobStr || undefined,
        bank: hasBank
          ? { name: bank.name, accountType: bank.accountType, routing: bank.routing, accountLast4: bank.account.slice(-4) }
          : undefined,
        debts: debts.length ? debts : undefined,
      },
    },
  });

  // Notify the rep (best-effort).
  try {
    const url = req.opportunityId ? `/opportunities/${req.opportunityId}` : "/";
    const who = req.recipientName || "A client";
    await prisma.notification.create({
      data: {
        recipientId: req.createdById,
        kind: "GENERIC",
        title: `${who} submitted their information`,
        body: addrLine || info.email || info.phone || "Info received",
        url,
        entityType: req.opportunityId ? "Opportunity" : "Account",
        entityId: req.opportunityId ?? req.accountId ?? undefined,
      },
    });
    const rep = await prisma.user.findUnique({
      where: { id: req.createdById },
      select: { email: true },
    });
    if (rep?.email) {
      const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
      await sendESignEmail({
        from,
        to: rep.email,
        subject: `${who} submitted their information`,
        html: `<p>${who} submitted their info.</p><pre style="font-family:inherit">${noteBody.replace(/</g, "&lt;")}</pre><p><a href="${appBaseUrl()}${url}">Open in the CRM</a></p>`,
      });
    }
  } catch {
    // ignore notification failures
  }

  return NextResponse.json({ ok: true });
}
