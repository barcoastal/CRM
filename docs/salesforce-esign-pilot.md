# Salesforce Coastal Sign sandbox pilot

DocuSign remains installed and its existing actions are preserved. A separate
**Send with Coastal E-Sign (TEST)** Opportunity action opens the pilot. Production
Salesforce is not a deployment target.

## Pilot behavior

1. Open the configured TEST Opportunity in `newdocusig`.
2. Choose the Coastal action. Complete the same native Salesforce details review
   and validation used by the current Send Contract flow, or resume an existing packet.
3. Documents, Recipients, Prepare & Send and packet status open inside Salesforce.
   No separate CRM login or tab is required. Field anchors come from CRM Word templates.
4. All pages are stamped TEST - NOT A CONTRACT; subjects start with [TEST].
   Both signing and copy recipients are restricted by the server to the approved
   test mailbox. No mail is sent during preparation.
5. After signing, use **Refresh signing status** in Salesforce. Completed PDF
   integrity is checked by CRM before transfer. Salesforce attaches it to Files
   once, with a dedicated Coastal packet/status/file reference.

## Deliberate pilot limits

- One configured sandbox org, sender, Opportunity and mailbox. No production
  customer import and no changes to production Salesforce.
- The test uses the CRM's six-month sample schedule defaults and Citadel legal
  plan. This is NOT verified parity with Salesforce quote/program-plan data.
- The sender remains embedded inside Salesforce. The native review component is a separate copy of the sandbox DocuSign review UI, preserving its required-field, debt, schedule, payment and legal-network checks. Existing DocuSign components are not modified.
- Status refresh is manual. StageName is not updated, avoiding copied Salesforce
  payment/welcome automations. Automatic status sync and quote/routing parity
  remain prerequisites for a live rollout.
- Reopening resumes the current packet. Completing a new details review prepares a fresh draft from current Salesforce values; old packets remain in the CRM audit history.
- Signed PDF transfer is capped at 3.5 MB; larger packets remain downloadable
  from CRM. No signed-document retention policy is weakened by the integration.

## Installation

Metadata lives in `salesforce/esign-pilot`. Validate and deploy with explicit
`--target-org newdocusig` and `RunSpecifiedTests CoastalESignPilotControllerTest`.
Apex enforces sandbox status and the `Coastal_ESign_Pilot` custom permission;
assign its permission set only to the pilot user.

The extensible `Coastal_ESign_Pilot` Named Credential points at the CRM custom
host. Its Custom External Credential `Coastal_ESign_Pilot_Auth`, principal
`Pilot`, stores `ApiKey` using the Salesforce credential REST API. The key never
appears in source, Apex or frontend URLs. CRM stores only its SHA-256 digest in
an active IntegrationCredential (`SALESFORCE_ESIGN_SANDBOX`, name = org ID), with
orgId, opportunityId, salesforceUserId, senderUserId, recipientEmail and a sandbox
instanceUrl. Rotation replaces the credential and digest together; setting the
integration inactive disables calls.

Apply migration `20261001070000_salesforce_esign_pilot` before CRM deployment.
It adds one nullable JSON field to SigningPacket; existing native packets retain
null and their existing behavior. The server creates immutable Salesforce source
metadata; the sender PATCH route cannot replace it.

The sandbox metadata copies of the two Opportunity layouts and two Lightning
pages only add the separate Coastal action. Existing DocuSign actions remain.
Review current target metadata again before any later deployment to another org.

## Embedded sender access

The Salesforce action calls the Named Credential to request a 30-minute capability
scoped to one packet, sandbox org and user. The fragment carries it into the
embedded page and is immediately removed; browser API calls use an Authorization
header. Only existing single-packet endpoints accept it, and each rechecks the
active integration, owner, org and Opportunity. CRM account cookies are not
required in the iframe. The shared machine credential never reaches the browser.
Frame embedding is limited to the newdocusig Lightning origin, with a matching
Salesforce CSP Trusted Site. Closing returns to the Opportunity without a CRM tab.

A test Opportunity without debt, draft or debit-schedule records cannot pass the
standard review validations. Its existing prepared sample can still be resumed.
The merged payment terms remain sample defaults, not production quote parity.
