# Five9 opener CRM frame

The CRM exposes `https://crm.coastaldebt-tools.com/five9/opener` for an embedded tab in Five9 Agent Desktop Plus. It shows the CRM lead for the signed-in agent's current Five9 call, lets the agent verify and edit the lead, and records a disposition. If the call has no matching lead, the agent can create one assigned to themselves.

## Five9 setup

In the Five9 Administrator Console, create a Classic Connector with the HTTPS URL above, `GET`, `In Browser` execution, and `Use embedded tab for Web Agent`. Use `Add Field` to pass `Call.number` as the GET parameter `phone`, and optionally `Customer.number1` as `number1`. `Call.number` is the safer source for manual dialing because a manually entered number may have no Five9 contact record. The frame uses the first populated phone parameter to open the matching CRM lead without a supervisor session. It also offers a manual phone search. Use `On Preview` for a preview campaign so the tab opens when the agent accepts a preview record; use `On Call Accepted` when enabling a call-driven campaign later. A manual outbound call does not fire the `On Preview` trigger. Do not add a shared CRM token to the URL.

Five9 attaches Classic Connectors to campaigns. The Bar1 pilot uses a separate `Bar1 CRM Frame Pilot` outbound Preview campaign with the `Bar1 CRM Frame Pilot` skill assigned only to `bar1@coastaldebt.com`. Use unlimited preview time and a list containing only a controlled test number. Keep the campaign stopped until the list, connector, and skill are verified. Do not attach the connector to a shared campaign for the pilot: that would show other agents the tab even though the CRM allowlist would deny them access.

For a manually dialed call, a separate `Bar1 CRM Manual` connector with the `Manually Started` trigger appears under **Connectors** on the call screen. The agent must choose it during the live call; Five9's guide says its embedded content opens in the native **Connector** tab. This still needs a live UI verification. Five9's `On Call Accepted` trigger applies to calls routed from the ACD, so it does not automate a manually initiated call. The `Bar1 CRM Frame Pilot` campaign currently exposes only two dispositions in Agent Desktop Plus. Add the opener dispositions to the campaign's middle **Call Disposition(s)** list and save; the **System Disposition(s)** and **Decline Preview Record Disposition(s)** lists serve different purposes. Retest the agent menu before using the campaign for opener work.

Five9's [Administrator Console guide](https://documentation-be.five9.com/bundle/administrator-console/raw/resource/enus/administrator-console.pdf) says web agents need HTTPS, and the Embedded tab requires the embedded URL call. The CRM route responds with `Content-Security-Policy: frame-ancestors https://*.five9.com` and has no `X-Frame-Options` header.

Each opener signs in to their own CRM account inside the frame on first use. The frame has a separate secure, partitioned session cookie; normal CRM sessions do not change. Set `FIVE9_FRAME_PILOT_EMAILS` to the comma-separated CRM emails allowed to load the pilot frame. The CRM account needs `Lead.View` and `Lead.Edit`. Set `User.five9Username` to the opener's Five9 login when the login differs from their CRM email or displayed name. The call lookup also requires the CRM lead to be assigned within the opener's normal record access scope.

## Verification

1. Deploy the CRM version containing `/five9/opener`.
2. Open the frame in Agent Desktop Plus, sign in as a test opener, and confirm it shows the waiting state.
3. Connect a test call to a lead assigned to that opener. Confirm the matching lead appears, edit a field, save, and disposition it.
4. Connect a call with no matching lead. Confirm the quick-create form assigns the new lead to the opener.
5. Check a second opener's frame to confirm the first opener's lead and session are not visible.

The Five9 connector's contact number drives the frame's screen pop. If it cannot match, confirm that the connector sends `number1` or `phone` and that the CRM lead's phone is accessible to the signed-in agent. The standard CRM dialer still uses the supervisor feed when a dedicated supervisor account is configured. The frame does not place or control calls; Five9 remains the call interface.
