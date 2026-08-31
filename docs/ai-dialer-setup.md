# AI dialer setup

The CRM uses Retell for the AI conversation, company-owned Twilio numbers for
caller ID, and Google Calendar for appointment availability and booking.

## Safety gates

An AI campaign cannot dial a lead unless:

- the campaign uses `dialerMode=AI`, has `aiEnabled=true`, and has a published Retell agent ID;
- the lead has affirmative consent plus the exact consent text, source, and timestamp;
- the number is not on the CRM suppression list and the lead is not marked DNC;
- the call is inside both the campaign window and 8 a.m.–9 p.m. in every time zone that may apply to the lead's state;
- a company-owned active caller ID exists for the lead's state or as a default fallback.

These are engineering controls, not a substitute for review by U.S. telemarketing counsel.

## Retell

1. Create and publish an English voice agent in Retell.
2. Import each Twilio number into Retell. Every number must accept callbacks.
3. Add the number through `POST /api/ai-dialer/numbers` with `phoneNumber`,
   two-letter `state` (or null for fallback), and its Retell number ID.
4. Set the account or agent webhook to `https://YOUR_CRM/api/webhooks/retell`.
5. Configure these post-call analysis booleans: `qualified`, `meeting_booked`,
   `transferred`, and `do_not_call`; optionally return `meeting_start` as ISO 8601.
6. Add custom tools for availability and booking:
   - `POST /api/ai-dialer/tools/availability`
   - `POST /api/ai-dialer/tools/book-meeting`
   Both send `Authorization: Bearer $AI_DIALER_TOOL_SECRET`.
7. Configure a warm-transfer tool whose destination is the dynamic variable
   `transfer_number`. The CRM supplies it from `AI_DIALER_TRANSFER_NUMBER`.

The opening line should disclose the company and AI nature of the call, then
offer an immediate opt-out. The agent must invoke the DNC outcome whenever the
person says stop, do not call, remove me, or equivalent language.

## Google Calendar

1. Enable Google Calendar API in a Google Cloud project.
2. Create a Web Application OAuth client and add the exact redirect URI from
   `GOOGLE_CALENDAR_REDIRECT_URI`.
3. Set the Google and encryption environment variables in `.env`.
4. While signed in as an integration administrator, visit
   `/api/integrations/google-calendar/connect` and approve access.

The app requests only calendar event and free/busy access. Refresh tokens are
encrypted with AES-256-GCM before database storage.

## Launching a controlled batch

Store consent evidence:

```http
POST /api/leads/LEAD_ID/ai-consent
Content-Type: application/json

{
  "consented": true,
  "consentText": "The exact disclosure the lead accepted...",
  "consentSource": "website-form-v3",
  "consentAt": "2026-08-30T12:00:00.000Z"
}
```

Then launch up to the campaign's concurrency limit:

```http
POST /api/ai-dialer/campaigns/CAMPAIGN_ID/launch
Content-Type: application/json

{ "limit": 10 }
```

Start at 10 active calls. Increase only after reviewing answer rate, DNC rate,
complaints, transfer availability, latency, recordings, and webhook delivery.
