# Reports and dashboards: first functionality release

- Saved-report dashboard tiles execute the real report runner with definition visibility, Reports.View, object access, record scope and relation redaction. Grouped reports show record counts; ungrouped reports preview 20 rows and four columns. Open report links provide the full configured result.
- Dashboard Refresh reloads tiles.
- Report viewer exports the current result to CSV, with escaped cells and formula-safe text. This exports only the displayed result, not an unlimited query.
- Reports, previews and report-backed tiles warn when their source-record limit truncates results. An extra fetched row detects truncation without contributing to totals.
- Averages exclude missing values; relationship fields used only in summaries now load correctly.

Validation: 486 tests passed, five skipped. Includes saved-report tile access/isolation, inaccessible definitions, truncation, averages and CSV escaping. No production customer data changes or outbound messages.

Remaining: formula editor, scheduled subscriptions, cross-object report expansion, advanced drilldowns and full-data aggregation beyond configured limits. Existing JSON/computed filtering and imported boolean filter semantics require further work. This release does not claim full reporting parity.
