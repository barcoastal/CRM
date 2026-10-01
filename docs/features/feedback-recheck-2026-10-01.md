# Feedback recheck — October 1

The live feedback page contains 38 entries: 10 New, 2 Working on it, and 26 Done. This recheck includes the completed entries rather than treating their status as proof of completion. Account 2 remains the accepted account layout.

Three completed reports still reproduced on their linked production records:

- **Victory Legal Plan clients missing** (Ferron, August 24): the report failed because its saved `primaryContact.name` column selected a nonexistent Contact field. Report metadata now maps that existing key to `primaryContact.fullName`, preserving saved columns, filters, sorting and grouping.
- **Wrong activity date / repeated date in subject** (Bar, September 9): call rows used a date-only Salesforce task due date, while their subject contained the call timestamp. Imported completed calls now read both legacy subject formats, respecting explicit EST/EDT or Eastern daylight saving when the zone is omitted. The subject suffix is removed only when successfully parsed. Other completed activities use completion/creation time; open tasks retain their due date. Both tables and activity rails show explicit Eastern time.
- **Tasks versus notifications** (Bar, August 10): completed disposition and stage-change entries were all shown as tasks, and imported email tasks were also mislabeled. Activity presentation now preserves email/note types and identifies system updates as notifications. Account and opportunity activity tables can filter by type; real checklist actions remain tasks.

No historical task records are rewritten or merged. Duplicate imported call records remain separate because similar timestamps alone do not establish that they are the same call. No feedback statuses are changed or reporter notifications sent.

The additional debt-status request still does not specify the new label or its meaning. Current/Default/Reprieve and Daily/Weekly/Monthly remain the verified source-system choices. The QA entry `zssni` has no actionable requirement.

Regression coverage includes real examples of both call subject formats, winter/summer offsets, invalid timestamps, scheduled tasks, system updates, VLP report compatibility, and every report field path against the Prisma schema. Production verification uses read-only record screens and reports.
