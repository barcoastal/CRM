# Five9 opener CRM frame

The CRM exposes `https://crm.coastaldebt-tools.com/five9/opener` for an embedded tab in Five9 Agent Desktop Plus. It shows the CRM lead for the signed-in agent's current Five9 call, lets the agent verify and edit the lead, and records a disposition. If the call has no matching lead, the agent can create one assigned to themselves.

## Five9 setup

In the Five9 Administrator Console, create an HTTPS Web Connector with the URL above, an `On Call Accepted` trigger, browser execution, and the Agent Desktop Plus embedded tab. Do not add a shared CRM token to the URL.

Five9 attaches standard Web Connectors to campaigns. Before enabling the Bar1 pilot, confirm that the selected campaign is used only by Bar1 or that Five9 offers a separate per-agent configuration in this domain. Adding the connector to a campaign shared by other agents would show them the tab too, even though the CRM pilot allowlist would deny them access. Do not change routing or attach the connector to a shared campaign for the pilot.

Five9's [Administrator Console guide](https://documentation-be.five9.com/bundle/administrator-console/raw/resource/enus/administrator-console.pdf) says web agents need HTTPS, and the Embedded tab requires the embedded URL call. The CRM route responds with `Content-Security-Policy: frame-ancestors https://*.five9.com` and has no `X-Frame-Options` header.

Each opener signs in to their own CRM account inside the frame on first use. The frame has a separate secure, partitioned session cookie; normal CRM sessions do not change. Set `FIVE9_FRAME_PILOT_EMAILS` to the comma-separated CRM emails allowed to load the pilot frame. The CRM account needs `Lead.View` and `Lead.Edit`. Set `User.five9Username` to the opener's Five9 login when the login differs from their CRM email or displayed name. The call lookup also requires the CRM lead to be assigned within the opener's normal record access scope.

## Verification

1. Deploy the CRM version containing `/five9/opener`.
2. Open the frame in Agent Desktop Plus, sign in as a test opener, and confirm it shows the waiting state.
3. Connect a test call to a lead assigned to that opener. Confirm the matching lead appears, edit a field, save, and disposition it.
4. Connect a call with no matching lead. Confirm the quick-create form assigns the new lead to the opener.
5. Check a second opener's frame to confirm the first opener's lead and session are not visible.

The supervisor feed drives the screen pop. If it cannot match the call, confirm the agent's Five9 username and the lead's phone number or contact name in CRM. The frame does not place or control calls; Five9 remains the call interface.
