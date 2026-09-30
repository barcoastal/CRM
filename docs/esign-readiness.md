# E-sign release readiness

This release improves evidence and signing controls. It does not certify legal
compliance, establish an individual's legal identity, or verify a person's actual
authority to bind a business. Counsel must approve the agreement, disclosures,
applicable state/document requirements and retention policy before customer use.

## Implemented controls

- One-time code to the envelope email before document access and signing.
  Codes expire after 10 minutes; five attempts per challenge; five sends per
  envelope per hour and 60 seconds between sends. Codes are stored as HMACs,
  never plaintext. Verification is bound to recipient, envelope and PDF digest.
- HttpOnly, SameSite=Strict verification cookie, Secure in production, 30-minute
  lifetime. AUTH_SECRET or NEXTAUTH_SECRET must be configured consistently.
- New signing links use 256 random bits and expire after 30 days. The signing API
  and prepared-document API both enforce expiry and active state.
- Explicit, unchecked consent to a versioned disclosure, capability to retain the
  PDF, review of the agreement, intent to sign and assertion of business authority.
  Disclosure text and version, asserted full name, verified email reference,
  timestamp, IP and user agent are retained in completion events.
- Required fields and consent are validated on the server. Initials require a
  separate adoption. One full name populates every full-name marker; editing the
  name clears previously adopted signatures and initials.
- Prepared PDFs are exclusive-create snapshots with SHA-256 sidecars. Signing
  checks PDF and field-configuration hashes against verification evidence.
- Signed PDFs have unique, exclusive-create filenames. A database compare-and-set
  transition prevents concurrent completion/withdrawal/decline overwrites.
- Signed PDF hashes are stored in completion evidence and checked on download.
  Certificates contain source-document hash and the accepted disclosure. A
  downloadable JSON audit record includes the signed-document hash and events.
- Completion is committed before CRM write-back and notification side effects.
  Signed copies remain downloadable even when email delivery fails.
- Database retention SQL prevents modification of completed envelopes, deletion
  of completed envelopes (including parent cascade), and audit-event mutation.
  This must be applied separately; shipping application code alone is insufficient.

## Deployment sequence

1. Confirm production database and persistent PDF volume, and take restorable
   backups of both. Never use a local DATABASE_URL for the production check.
2. Establish independently retained, access-controlled backups for BOTH the
   database and `/data/esign-*` files. Confirm restore procedures and retention
   with the owner. The application checksums and database guards are not WORM
   storage, a trusted timestamp, or a CA-backed PDF digital signature.
3. In the target environment run:
   `node scripts/apply-esign-retention.cjs --check`
   then `node scripts/apply-esign-retention.cjs --apply`.
   Verify `retention_triggers` is 2. These triggers intentionally block CRM
   deletions that would erase an envelope's audit events.
4. Deploy application code and verify AUTH_SECRET/NEXTAUTH_SECRET and transactional
   email configuration. The persistent volume must retain the prepared hash files.
5. Send a NEW test envelope to an explicitly authorized test recipient. Older
   unsigned envelopes have no source hash and are intentionally blocked; resend
   as new envelopes. Do not fabricate retrospective verification evidence.
6. In desktop and mobile browsers verify code delivery, incorrect-code rejection,
   consent, PDF access, full-name reuse, initials, completion, copy download and
   audit download. Do not sign a real customer agreement as a test.
7. Review the completed PDF and audit record with counsel before customer use.

## Outstanding operational/legal decisions

- Production retention SQL application and independent backup/restore verification.
- Approved retention duration, paper-copy process/fees and contact-update process.
  Current disclosure is a product draft, not counsel-approved language.
- Whether stronger identity verification, company countersignature, witnesses,
  notarization, or additional disclosures are required for a particular document.
- Current template business/financial merge mappings and company countersigner.
- A complete real-email test remains required; automated tests mock email delivery.
- Application checks do not protect against an infrastructure administrator who
  can replace PDFs and hashes, change the database or disable its triggers.

## Validation

Vitest tests cover snapshot alteration/overwrite, proof binding/expiry, required
fields and consent, OTP rate limits/reuse/expiry, completed PDF generation and
hashes, competing state transitions, and PostgreSQL retention triggers (PGlite).
The generated certificate and disclosure are rendered and visually inspected.
No real customer documents are signed by the automated tests.
