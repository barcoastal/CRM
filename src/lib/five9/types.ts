/**
 * Five9 webhook + API types.
 * Field names mirror the SF Five9 connector (Five9ConnectorParams.cls).
 */

export interface Five9CallEvent {
  // Identity
  call_id?: string;
  session_id?: string;
  ani?: string;         // calling party (inbound) / caller ID (outbound)
  dnis?: string;        // dialed party
  phone_number?: string;

  // Agent
  agent_id?: string;
  agent_full_name?: string;
  user_name?: string;

  // Campaign / routing
  campaign_name?: string;
  dialer_group?: string;
  skill_name?: string;
  call_type?: string;   // Manual | Outbound | Inbound | Internal

  // Disposition + outcomes
  disposition_name?: string;
  f9_last_disposition?: string;
  f9_last_disposition_date?: string;
  attempt_count?: string;

  // Times
  call_start_time_stamp?: string;
  call_end_time_stamp?: string;
  call_handle_time?: string;
  call_hold_time?: string;
  call_length?: string;

  // Related records — Five9 can pass these from the screen-pop URL
  lead_id?: string;
  opportunity_id?: string;
  account_id?: string;

  // Other
  language?: string;
  recording_url?: string;
}
