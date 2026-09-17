# Account negotiator assignment

Accounts now support a native `assignedNegotiatorId` relation to an active CRM user. The Account Details field has an Assign negotiator dropdown, and Account Team displays the saved user. Saving, changing, and clearing the assignment creates Account History and AuditLog entries in the same transaction.

The imported Salesforce `Debt_Negotiator__c` value remains visible as a separately labeled reference. Existing Salesforce data is not automatically interpreted as a CRM permission grant. The native assignment is independent of the nightly Salesforce snapshot, which does not overwrite it. No existing records are assigned by deployment.

## Authorization

- Assigners need Account.Edit plus ownership of the account, membership above its owner in the explicit manager tree, or the existing active ADMIN/SUPER_ADMIN scope.
- Targets must be active and have Account.View and Opportunity.View effective permissions. The dropdown lists active staff; invalid permissions produce a clear error when saving.
- The selected negotiator and their explicit managers gain record scope to the assigned account and its opportunities. Existing object/action permissions still apply. Account ownership and opportunity ownership remain unchanged.
- Contacts are not automatically shared. Existing archive restrictions remain in place.
- Record pages/APIs and report/dashboard queries use the same assignment scope. Reassignment or removal takes effect on subsequent requests; already downloaded data cannot be recalled.
- Assignment sharing does not grant reassignment authority. Owner changes on inline, normal, and both account bulk edit paths remain limited to owner/manager/admin scope.
- The assignment endpoint checks the previous assignee and uses a conditional update to reject concurrent assignment changes. Generic field/bulk endpoints cannot directly change the negotiator relation.

## Deployment

The schema change adds one nullable Account column, index, and optional User foreign key. This repository's existing startup schema synchronization applies it. There is no data backfill or deletion. Generate the Prisma client during the normal production build.

## Validation

Focused tests cover assignment authorization, inactive and underprivileged targets, clearing, stale/concurrent changes, atomic history/audit invocation, analytics sharing/revocation, and bulk reassignment bypasses. Verify the dropdown on an account after deployment without assigning a real account solely for a smoke test.
