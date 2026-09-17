# Negotiation eligibility

Negotiation work is limited to opportunities in either canonical Closed Won stage:

- Closed Won First Payment Pending
- Closed Won - First Payment Completed

The linked account must have `clientStatus = Active` and `isActive = true`. Client Status is the operational status used by the account page/path. An absent account, a soft-deleted account, or any other client status is ineligible. Ordinary opportunity and account records remain available under their existing permissions.

The same lifecycle filter applies to negotiation list counts/search/pagination and direct workspace URLs. Server-side checks also protect negotiation stage changes, activity creation, offer creation, negotiation-document access, and emails sent from the negotiation composer. Legacy client negotiation endpoints apply the rule too. Ordinary Email Center messages remain available for non-won opportunities.

Historical negotiation records are retained. Eligibility is checked from current data on each request, in addition to existing object and record permissions.
