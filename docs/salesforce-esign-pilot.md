# Salesforce Coastal Sign sandbox pilot

DocuSign remains installed and its existing actions are preserved. A separate
**Send with Coastal E-Sign (TEST)** Opportunity action opens the pilot. Production
Salesforce is not a deployment target.

## Pilot behavior

1. Open the configured TEST Opportunity in `newdocusig`.
2. Choose the Coastal action. Review the account, email and debt, signer name,
   SAS/RAM processor and optional addendum.
3. Prepare once, then open the CRM sender. The existing CRM login is required;
   the packet is scoped to the mapped CRM sender. Review Documents, Recipients,
   and Prepare & Send. Field anchors come from the CRM Word templates.
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
- The sender opens in a separate CRM tab, not an embedded Salesforce iframe.
- Status refresh is manual. StageName is not updated, avoiding copied Salesforce
  payment/welcome automations. Automatic status sync and quote/routing parity
  remain prerequisites for a live rollout.
- One stable draft per Opportunity/pilot version, retry-safe preparation.
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
