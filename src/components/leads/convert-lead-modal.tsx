"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCOUNT_RECORD_TYPES, OPPORTUNITY_RECORD_TYPES } from "@/lib/record-types";

const ACCOUNT_RT_LABEL: Record<string, string> = {
  VENDOR: "Vendor",
  CLIENT: "Client",
  BUSINESS_ACCOUNT: "Business Account",
  BUYOUT: "Buyout",
  CREDITOR: "Creditor",
  PERSON_ACCOUNT: "Person Account",
};

const OPP_RT_LABEL: Record<string, string> = {
  DEBT_SETTLEMENT: "Debt Settlement",
  BUYOUT: "Buyout",
  RESTRUCTURE: "Restructure Program",
  LIMITED_ASSET_PROTECTION: "Limited Asset Protection",
};

type AccountSuggestion = { id: string; name: string };
type ContactSuggestion = { id: string; name: string };

interface ConvertLeadModalProps {
  leadId: string;
  open: boolean;
  onClose: () => void;
  initialAccountName: string;
  initialContactFirstName: string;
  initialContactLastName: string;
  initialOpportunityName: string;
}

/**
 * SF Lightning Convert Lead modal — three collapsible Account / Contact /
 * Opportunity sections, each with Create New / Choose Existing radio toggles.
 * Verified against the SF screenshots Bar shared 2026-06-07.
 */
export function ConvertLeadModal({
  leadId,
  open,
  onClose,
  initialAccountName,
  initialContactFirstName,
  initialContactLastName,
  initialOpportunityName,
}: ConvertLeadModalProps) {
  const router = useRouter();

  // Account section
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new");
  const [accountOpen, setAccountOpen] = useState(true);
  const [accountName, setAccountName] = useState(initialAccountName);
  const [accountRecordType, setAccountRecordType] = useState<string>("BUSINESS_ACCOUNT");
  const [existingAccountId, setExistingAccountId] = useState<string>("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountSuggestions, setAccountSuggestions] = useState<AccountSuggestion[]>([]);

  // Contact section
  const [contactMode, setContactMode] = useState<"new" | "existing">("new");
  const [contactOpen, setContactOpen] = useState(false);
  const [salutation, setSalutation] = useState("");
  const [firstName, setFirstName] = useState(initialContactFirstName);
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState(initialContactLastName);
  const [suffix, setSuffix] = useState("");
  const [existingContactId, setExistingContactId] = useState<string>("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([]);

  // Opportunity section
  const [opportunityMode, setOpportunityMode] = useState<"new" | "existing">("new");
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [opportunityName, setOpportunityName] = useState(initialOpportunityName);
  const [opportunityRecordType, setOpportunityRecordType] = useState<string>("DEBT_SETTLEMENT");
  const [dontCreateOpp, setDontCreateOpp] = useState(false);
  const [existingOpportunityId, setExistingOpportunityId] = useState<string>("");

  // Footer
  const [recordOwnerId, setRecordOwnerId] = useState<string>("");
  const [recordOwnerLabel, setRecordOwnerLabel] = useState<string>("");
  const [convertedStatus, setConvertedStatus] = useState<string>("Converted");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset error when reopened
  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // Debounce account search
  useEffect(() => {
    if (accountMode !== "existing" || accountSearch.trim().length < 2) {
      setAccountSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/accounts/search?q=${encodeURIComponent(accountSearch.trim())}`);
        if (r.ok) {
          const d = await r.json() as { results?: AccountSuggestion[] };
          setAccountSuggestions(d.results ?? []);
        }
      } catch { /* */ }
    }, 250);
    return () => clearTimeout(t);
  }, [accountSearch, accountMode]);

  useEffect(() => {
    if (contactMode !== "existing" || contactSearch.trim().length < 2) {
      setContactSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/contacts/search?q=${encodeURIComponent(contactSearch.trim())}`);
        if (r.ok) {
          const d = await r.json() as { results?: ContactSuggestion[] };
          setContactSuggestions(d.results ?? []);
        }
      } catch { /* */ }
    }, 250);
    return () => clearTimeout(t);
  }, [contactSearch, contactMode]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        accountRecordType: accountMode === "new" ? accountRecordType : undefined,
        existingAccountId: accountMode === "existing" ? existingAccountId || undefined : undefined,
        accountName: accountMode === "new" ? accountName : undefined,

        existingContactId: contactMode === "existing" ? existingContactId || undefined : undefined,
        contactSalutation: contactMode === "new" ? salutation || undefined : undefined,
        contactFirstName: contactMode === "new" ? firstName || undefined : undefined,
        contactMiddleName: contactMode === "new" ? middleName || undefined : undefined,
        contactLastName: contactMode === "new" ? lastName || undefined : undefined,
        contactSuffix: contactMode === "new" ? suffix || undefined : undefined,

        opportunityRecordType: opportunityMode === "new" && !dontCreateOpp ? opportunityRecordType : undefined,
        opportunityName: opportunityMode === "new" && !dontCreateOpp ? opportunityName : undefined,
        existingOpportunityId: opportunityMode === "existing" ? existingOpportunityId || undefined : undefined,
        doNotCreateOpportunity: dontCreateOpp,

        accountOwnerId: recordOwnerId || undefined,
        convertedStatus,
      };
      const res = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json() as { error?: string; accountId?: string };
      if (!res.ok) throw new Error(d.error ?? "Conversion failed");
      router.push(`/accounts/${d.accountId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" onClick={() => !submitting && onClose()} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <header style={header}>
          <span style={{ width: 24 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#181818", margin: 0, flex: 1, textAlign: "center" }}>
            Convert Lead
          </h2>
          <button onClick={onClose} aria-label="Close" style={closeBtn}>×</button>
        </header>

        <div style={body}>
          {/* ACCOUNT */}
          <CollapsibleSection title="Account" open={accountOpen} onToggle={() => setAccountOpen((o) => !o)}>
            <TwoColumnPicker
              mode={accountMode}
              onModeChange={setAccountMode}
              leftLabel="Create New Account"
              rightLabel="Choose Existing Account"
              leftBody={
                <>
                  <RequiredLabel>Account Name</RequiredLabel>
                  <input value={accountName} onChange={(e) => setAccountName(e.target.value)} style={input} />
                  <Label>Record Type</Label>
                  <select value={accountRecordType} onChange={(e) => setAccountRecordType(e.target.value)} style={input}>
                    {ACCOUNT_RECORD_TYPES.map((rt) => (
                      <option key={rt} value={rt}>{ACCOUNT_RT_LABEL[rt] ?? rt}</option>
                    ))}
                  </select>
                </>
              }
              rightBody={
                <>
                  <Label>Account Search</Label>
                  <input
                    placeholder="Search for matching accounts"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    style={input}
                  />
                  {accountSuggestions.length > 0 && (
                    <div style={suggestionBox}>
                      {accountSuggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setExistingAccountId(s.id); setAccountSearch(s.name); setAccountSuggestions([]); }}
                          style={{ ...suggestionItem, fontWeight: s.id === existingAccountId ? 600 : 400 }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              }
            />
          </CollapsibleSection>

          {/* CONTACT */}
          <CollapsibleSection title="Contact" open={contactOpen} onToggle={() => setContactOpen((o) => !o)}>
            <TwoColumnPicker
              mode={contactMode}
              onModeChange={setContactMode}
              leftLabel="Create New Contact"
              rightLabel="Choose Existing Contact"
              leftBody={
                <>
                  <Label>Salutation</Label>
                  <select value={salutation} onChange={(e) => setSalutation(e.target.value)} style={input}>
                    <option value="">--None--</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                  </select>
                  <Label>First Name</Label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
                  <Label>Middle Name</Label>
                  <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} style={input} />
                  <RequiredLabel>Last Name</RequiredLabel>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
                  <Label>Suffix</Label>
                  <input value={suffix} onChange={(e) => setSuffix(e.target.value)} style={input} />
                </>
              }
              rightBody={
                <>
                  <Label>Contact Search</Label>
                  <input
                    placeholder="Search for matching contacts"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    style={input}
                  />
                  {contactSuggestions.length > 0 && (
                    <div style={suggestionBox}>
                      {contactSuggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { setExistingContactId(s.id); setContactSearch(s.name); setContactSuggestions([]); }}
                          style={{ ...suggestionItem, fontWeight: s.id === existingContactId ? 600 : 400 }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              }
            />
          </CollapsibleSection>

          {/* OPPORTUNITY */}
          <CollapsibleSection title="Opportunity" open={opportunityOpen} onToggle={() => setOpportunityOpen((o) => !o)}>
            <TwoColumnPicker
              mode={opportunityMode}
              onModeChange={setOpportunityMode}
              leftLabel="Create New Opportunity"
              rightLabel="Choose Existing Opportunity"
              leftBody={
                <>
                  <RequiredLabel>Opportunity Name</RequiredLabel>
                  <input
                    value={opportunityName}
                    onChange={(e) => setOpportunityName(e.target.value)}
                    style={input}
                    disabled={dontCreateOpp}
                  />
                  <Label>Record Type</Label>
                  <select
                    value={opportunityRecordType}
                    onChange={(e) => setOpportunityRecordType(e.target.value)}
                    style={input}
                    disabled={dontCreateOpp}
                  >
                    {OPPORTUNITY_RECORD_TYPES.map((rt) => (
                      <option key={rt} value={rt}>{OPP_RT_LABEL[rt] ?? rt}</option>
                    ))}
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: "#444444" }}>
                    <input
                      type="checkbox"
                      checked={dontCreateOpp}
                      onChange={(e) => setDontCreateOpp(e.target.checked)}
                    />
                    Don&apos;t create an opportunity upon conversion
                  </label>
                </>
              }
              rightBody={
                <>
                  <Label>To find opportunity, choose an existing account</Label>
                  <input
                    placeholder="0 Opportunity Matches"
                    value={existingOpportunityId}
                    onChange={(e) => setExistingOpportunityId(e.target.value)}
                    style={input}
                    disabled={dontCreateOpp}
                  />
                </>
              }
            />
          </CollapsibleSection>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, paddingTop: 12, borderTop: "1px solid #ecebea" }}>
            <div>
              <RequiredLabel>Record Owner</RequiredLabel>
              <UserPicker
                value={recordOwnerId}
                label={recordOwnerLabel}
                onPick={(u) => { setRecordOwnerId(u.id); setRecordOwnerLabel(u.name); }}
              />
            </div>
            <div>
              <RequiredLabel>Converted Status</RequiredLabel>
              <select value={convertedStatus} onChange={(e) => setConvertedStatus(e.target.value)} style={input}>
                <option value="Converted">Converted</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#fdecea", border: "1px solid #c23934", color: "#c23934", fontSize: 13, borderRadius: 4 }}>
              {error}
            </div>
          )}
        </div>

        <footer style={footer}>
          <button disabled={submitting} onClick={onClose} style={cancelBtn}>Cancel</button>
          <button disabled={submitting} onClick={submit} style={primaryBtn}>
            {submitting ? "Converting..." : "Convert"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid #ecebea" }}>
      <button onClick={onToggle} style={sectionHeader}>
        <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", color: "#747474" }}>▸</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>{title}</span>
      </button>
      {open && <div style={{ padding: "8px 0 16px 24px" }}>{children}</div>}
    </div>
  );
}

function TwoColumnPicker({
  mode, onModeChange, leftLabel, rightLabel, leftBody, rightBody,
}: {
  mode: "new" | "existing";
  onModeChange: (m: "new" | "existing") => void;
  leftLabel: string; rightLabel: string;
  leftBody: React.ReactNode; rightBody: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "start" }}>
      <div style={{ opacity: mode === "new" ? 1 : 0.55 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input type="radio" checked={mode === "new"} onChange={() => onModeChange("new")} />
          <span style={{ fontSize: 13, color: "#181818", fontWeight: 600 }}>{leftLabel}</span>
        </label>
        {leftBody}
      </div>
      <div style={{ alignSelf: "center", color: "#747474", fontSize: 12, padding: "0 8px" }}>- OR -</div>
      <div style={{ opacity: mode === "existing" ? 1 : 0.55 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <input type="radio" checked={mode === "existing"} onChange={() => onModeChange("existing")} />
          <span style={{ fontSize: 13, color: "#181818", fontWeight: 600 }}>{rightLabel}</span>
        </label>
        {rightBody}
      </div>
    </div>
  );
}

function UserPicker({ value, label, onPick }: { value: string; label: string; onPick: (u: { id: string; name: string }) => void }) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && users.length === 0) {
      fetch("/api/users")
        .then((r) => r.ok ? r.json() : { users: [] })
        .then((d) => setUsers((d.users ?? []) as { id: string; name: string }[]))
        .catch(() => { /* */ });
    }
  }, [open, users.length]);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...input, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 18, height: 18, background: "#747474", borderRadius: "50%", color: "#fff", fontSize: 10, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>👤</span>
        {label || (value ? "Selected" : "Select a user")}
      </button>
      {open && (
        <div style={suggestionBox}>
          {users.map((u) => (
            <button key={u.id} onClick={() => { onPick(u); setOpen(false); }} style={suggestionItem}>{u.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 12, color: "#444444", marginTop: 8, marginBottom: 2 }}>{children}</label>;
}
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, color: "#444444", marginTop: 8, marginBottom: 2 }}>
      <span style={{ color: "#c23934", marginRight: 2 }}>*</span>{children}
    </label>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(8,7,7,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000,
};
const modal: React.CSSProperties = {
  background: "#fff", borderRadius: 4, minWidth: 720, maxWidth: 880, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
};
const header: React.CSSProperties = {
  display: "flex", alignItems: "center", borderBottom: "1px solid #ecebea", padding: "12px 16px",
};
const closeBtn: React.CSSProperties = {
  background: "transparent", border: 0, fontSize: 24, color: "#747474", cursor: "pointer", lineHeight: 1,
};
const body: React.CSSProperties = { padding: "12px 24px", overflowY: "auto" };
const footer: React.CSSProperties = {
  display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 16px", borderTop: "1px solid #ecebea", background: "#fafaf9",
};
const sectionHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: 0, padding: "10px 0", cursor: "pointer", textAlign: "left",
};
const input: React.CSSProperties = {
  width: "100%", padding: "6px 8px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, background: "#fff",
};
const cancelBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #c9c9c9", color: "#0176d3", padding: "0 16px", height: 32, borderRadius: 4, fontSize: 13, cursor: "pointer",
};
const primaryBtn: React.CSSProperties = {
  background: "#0176d3", border: "1px solid #0176d3", color: "#fff", padding: "0 16px", height: 32, borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const suggestionBox: React.CSSProperties = {
  marginTop: 4, border: "1px solid #c9c9c9", borderRadius: 4, background: "#fff", maxHeight: 160, overflowY: "auto", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};
const suggestionItem: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", background: "transparent", border: 0, padding: "8px 12px", fontSize: 13, color: "#181818", cursor: "pointer",
};
