# Transfer passes and touchdown audio

## Behavior

- New Floor Manager `CloserHandoff` records trigger a 5.5-second pass animation, showing the sender, receiving closer and debt amount/range. No client name is exposed.
- Closed Won transitions retain the eight-second touchdown animation and named closer.
- Independent paginated event feeds share a chronological, deduplicated presentation queue. Fresh sessions skip old events. Existing win cursors migrate without replaying historical transfers. Reconnect catch-up is bounded to one hour.
- User-selected audio: https://www.youtube.com/watch?v=GU1o2blfeO0, 0:00–0:05. Hosted MP3, decoded after sound is enabled; touchdown playback capped at five seconds with a 100 ms fade. Passes have a short synthesized whoosh. Dismissal, sound-off and unmount stop active sound.
- `Test pass` and `Test touchdown` use local demo events without creating CRM records.
- Additive `CloserHandoff.createdAt` index supports the live pass query.

## Validation

- 66 focused tests passed across scoreboard feed/API and closer tier configuration/API suites, covering auth, validation, baseline behavior, missing sender, no client-name disclosure, composite pagination, reconnect window and mixed event deduplication.
- Targeted ESLint and `git diff --check` passed.
- Production webpack build passed with 8 GB Node heap. Final CSS sizing adjustment independently rebuilt in the actual-component browser preview.
- Chrome preview at 1920×1080: all 12 sample closers visible; blue pass animation, names, flight and debt fit. At 1728×902 the pass content fits within y=83–819; standings rotate with no table overflow.
- Sample mixed feed: Jamie Carter → Jordan Brooks pass, then Jordan Brooks touchdown, then return to standings. Sound enabled successfully and no browser errors recorded.
- MP3 decodes to approximately five seconds (4.9935 seconds of samples; encoded container includes padding), stereo 44.1 kHz. No clipped samples; peak −5.19 dBFS.
- No live assignments, deals or monthly goals were created or modified during verification.
