# Closer opportunity view

The 17 fields marked red in the two closer screenshots are hidden when the signed-in user's assigned hierarchy role is Closer (developer name or name), or their legacy role is CLOSER. The record owner's role and the phone-dialer `isCloser` flag do not determine the viewer's layout. Profile permissions remain separate.

Configure under Settings → Users → edit user → Access & Reporting → Role → Closer. The Closer hierarchy role already exists in production. No user assignments are changed by this release. The opportunity page reads the current assigned role on each server render, so the next page load reflects role changes.

Hidden fields: Secured Party; Call ASAP; Business Start Date; Hopper Priority; Outbound ANI Date, From and Identifier; Dialer Group; Re-shuffle Opportunity; Re-shuffle count; Processor Contract Formula; Ad Click Id; Opportunity Record Type; Affiliate; Eli Ad click; Has Closer Notes; Latest Closer Notes.

Each remaining field stays in its original column, with gaps removed. The All Fields panel omits the corresponding imported keys too. Processor, Opportunity Reshuffled DateTime, notes, activity, payment summaries and other unmarked fields remain available. Other roles keep the original complete layout and imported-field panel.

This is a display layout, not a change to record access, profile permissions, stored fields or API permissions.

Validation covers role selection, all 17 exclusions, unchanged non-closer fields, column placement, All Fields aliases and rendered field-grid output.
