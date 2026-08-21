/**
 * Five9 Supervisor real-time feed.
 *
 * A single always-on supervisor session (started from server.js) that holds the
 * Five9 Supervisor WebSocket (/supsvcs/sws/{key}_super) and keeps a live map of
 * every agent's current state + call. The CRM reads it (via /api/dialer/active-call)
 * to screen-pop the matching lead for whichever agent is on a call — outbound,
 * inbound, and transfers — with no per-call connector.
 *
 * Auth is cookies-only (same as the agent REST), but supervisor endpoints live
 * under /supsvcs/rs/svc (NOT /appsvcs/rs/svc) and the WebSocket under /supsvcs/sws.
 *
 * Env: FIVE9_SUPERVISOR_USERNAME, FIVE9_SUPERVISOR_PASSWORD (a Five9 user with the
 * Supervisor role + seat — dedicated to the integration, not a live agent).
 */
import WebSocket from "ws";
import { parseSetCookies, mergeCookies, cookieHeaderFor } from "./agent-api";

const LOGIN_BASE = process.env.FIVE9_AGENT_LOGIN_URL ?? "https://app.five9.com/appsvcs/rs/svc";
const SOCKET_KEY = "coastalcrm_super";

type Cookie = ReturnType<typeof parseSetCookies>[number];

export interface AgentCall {
  five9UserId: string;
  state: string; // ON_CALL, READY, NOT_READY, ACW, LOGGED_OUT, ...
  callType: string | null; // INBOUND / OUTBOUND / ...
  customer: string | null; // contact name from the campaign/CRM connector
  campaignId: string | null;
  onCallSince: number | null;
  updatedAt: number;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

class SupervisorFeed {
  private agentCalls = new Map<string, AgentCall>(); // five9UserId -> state/call
  private userIdByEmail = new Map<string, string>(); // lowercased email/username -> five9UserId
  private idByFullName = new Map<string, string>(); // lowercased "first last" -> five9UserId (ambiguous names dropped)
  private eventCounts: Record<string, number> = {}; // eventId -> count (diagnostics)
  private rawLog: Array<{ at: number; eventId: string | null; reason: string | null; preview: string }> = []; // last interesting messages
  private jar: Cookie[] = [];
  private apiHost = ""; // https://app-atl.five9.com:443/supsvcs/rs/svc
  private dcHost = ""; // app-atl.five9.com
  private dcPort = "443";
  private userId = "";
  private orgId = "";
  private farmId: string | null = null;
  private tokenId = "";
  private ws: WebSocket | null = null;
  private started = false;
  private stopping = false;

  status: { connected: boolean; lastEvent: number; agents: number; onCall: number; error?: string } = {
    connected: false,
    lastEvent: 0,
    agents: 0,
    onCall: 0,
  };

  start(): void {
    if (this.started) return;
    if (!process.env.FIVE9_SUPERVISOR_USERNAME || !process.env.FIVE9_SUPERVISOR_PASSWORD) {
      console.warn("[supervisor-feed] FIVE9_SUPERVISOR_USERNAME/PASSWORD not set — feed disabled");
      return;
    }
    this.started = true;
    void this.runForever();
  }

  /** Current live call for an agent identified by their Five9 username (email). */
  getCallForUsername(username: string | null | undefined): AgentCall | null {
    if (!username) return null;
    const id = this.userIdByEmail.get(username.toLowerCase());
    if (!id) return null;
    const call = this.agentCalls.get(id);
    if (!call) return null;
    // Only treat genuinely active states as "on a call".
    if (call.state !== "ON_CALL") return null;
    return call;
  }

  /**
   * Fallback match by the agent's full name ("First Last"), so a CRM user whose
   * Five9 login differs from their email still screen-pops without any manual
   * five9Username — as long as their name matches the Five9 roster and is not a
   * duplicate. Ambiguous (shared) names are dropped from the map, so they need
   * the explicit five9Username override instead.
   */
  getCallForName(name: string | null | undefined): AgentCall | null {
    if (!name) return null;
    const id = this.idByFullName.get(name.trim().toLowerCase().replace(/\s+/g, " "));
    if (!id) return null;
    const call = this.agentCalls.get(id);
    if (!call || call.state !== "ON_CALL") return null;
    return call;
  }

  /**
   * Raw live state for an agent (by Five9 username/email, then full-name
   * fallback), regardless of whether they are on a call. Used by transfer
   * routing to tell READY (free) from ON_CALL / NOT_READY / ACW. Returns null
   * when the agent is not in the live roster (e.g. logged out / feed down).
   */
  getStateFor(
    username?: string | null,
    name?: string | null,
  ): { state: string; onCallSince: number | null } | null {
    let id = username ? this.userIdByEmail.get(username.toLowerCase()) : undefined;
    if (!id && name) id = this.idByFullName.get(name.trim().toLowerCase().replace(/\s+/g, " "));
    if (!id) return null;
    const call = this.agentCalls.get(id);
    if (!call) return null;
    return { state: call.state, onCallSince: call.onCallSince };
  }

  /**
   * Probe what the org has licensed (to decide whether Five9 already provides
   * transcription/AI we can read, vs needing VoiceStream + Deepgram). Reads the
   * application seats and the supervisor's permission list via the live session.
   */
  async probeFeatures(): Promise<{ applicationSeats: unknown; permissions: unknown; errors: string[] }> {
    const errors: string[] = [];
    let permissions: unknown = null;
    let applicationSeats: unknown = null;
    if (!this.orgId || !this.userId) {
      return { applicationSeats: null, permissions: null, errors: ["feed session not ready"] };
    }
    try {
      const r = await this.svc(`/users/${this.userId}/permissions`, "GET", undefined, false);
      if (r.ok) permissions = await r.json().catch(() => null);
      else errors.push(`permissions ${r.status}: ${(await r.text()).slice(0, 120)}`);
    } catch (e) {
      errors.push("permissions: " + (e instanceof Error ? e.message : String(e)));
    }
    try {
      const r = await this.svc(`/orgs/${this.orgId}/application_seats`, "GET", undefined, false);
      if (r.ok) applicationSeats = await r.json().catch(() => null);
      else errors.push(`application_seats ${r.status}: ${(await r.text()).slice(0, 120)}`);
    } catch (e) {
      errors.push("application_seats: " + (e instanceof Error ? e.message : String(e)));
    }
    return { applicationSeats, permissions, errors };
  }

  /** Reverse map five9UserId -> a display username (prefer an @-email alias). */
  private displayNames(): Map<string, string> {
    const idToName = new Map<string, string>();
    for (const [name, id] of this.userIdByEmail.entries()) {
      const cur = idToName.get(id);
      if (!cur || (name.includes("@") && !cur.includes("@"))) idToName.set(id, name);
    }
    return idToName;
  }

  /** Every agent currently ON_CALL, for the live supervisor floor board. */
  liveCalls(now = Date.now()): Array<{
    five9UserId: string;
    username: string | null;
    callType: string | null;
    customer: string | null;
    campaignId: string | null;
    onCallSince: number | null;
    durationSec: number;
  }> {
    const names = this.displayNames();
    const out = [];
    for (const a of this.agentCalls.values()) {
      if (a.state !== "ON_CALL") continue;
      out.push({
        five9UserId: a.five9UserId,
        username: names.get(a.five9UserId) ?? null,
        callType: a.callType,
        customer: a.customer,
        campaignId: a.campaignId,
        onCallSince: a.onCallSince,
        durationSec: a.onCallSince ? Math.max(0, Math.floor((now - a.onCallSince) / 1000)) : 0,
      });
    }
    out.sort((x, y) => (y.onCallSince ?? 0) - (x.onCallSince ?? 0));
    return out;
  }

  /** Diagnostics: see what the feed actually holds (state distribution, on-call rows, mapping). */
  debugSnapshot(username?: string | null): {
    mapSize: number;
    userMapSize: number;
    nameMapSize: number;
    stateCounts: Record<string, number>;
    onCallAgents: Array<{ id: string; usernames: string[]; state: string; callType: string | null; customer: string | null; campaignId: string | null }>;
    sample: Array<{ id: string; state: string; callType: string | null; customer: string | null }>;
    lookup: { username: string; mappedId: string | null; foundCall: AgentCall | null } | null;
    eventCounts: Record<string, number>;
    rawLog: Array<{ at: number; eventId: string | null; reason: string | null; preview: string }>;
  } {
    // Reverse map: five9UserId -> usernames (an id can have several aliases).
    const idToNames = new Map<string, string[]>();
    for (const [name, id] of this.userIdByEmail.entries()) {
      const arr = idToNames.get(id) ?? [];
      arr.push(name);
      idToNames.set(id, arr);
    }
    const stateCounts: Record<string, number> = {};
    const onCallAgents: Array<{ id: string; usernames: string[]; state: string; callType: string | null; customer: string | null; campaignId: string | null }> = [];
    for (const a of this.agentCalls.values()) {
      stateCounts[a.state] = (stateCounts[a.state] ?? 0) + 1;
      // surface anyone genuinely on a live interaction so we can identify them
      if (a.state === "ON_CALL" || a.callType) {
        onCallAgents.push({ id: a.five9UserId, usernames: idToNames.get(a.five9UserId) ?? [], state: a.state, callType: a.callType, customer: a.customer, campaignId: a.campaignId });
      }
    }
    const sample = [...this.agentCalls.values()].slice(0, 5).map((a) => ({ id: a.five9UserId, state: a.state, callType: a.callType, customer: a.customer }));
    let lookup = null as null | { username: string; mappedId: string | null; foundCall: AgentCall | null };
    if (username) {
      const id = this.userIdByEmail.get(username.toLowerCase()) ?? null;
      lookup = { username, mappedId: id, foundCall: id ? this.agentCalls.get(id) ?? null : null };
    }
    return { mapSize: this.agentCalls.size, userMapSize: this.userIdByEmail.size, nameMapSize: this.idByFullName.size, stateCounts, onCallAgents, sample, lookup, eventCounts: this.eventCounts, rawLog: this.rawLog.slice(-12) };
  }

  /**
   * Merge AGENT_STATE rows from a stats message into the map. Handles both the
   * full-snapshot (event 5000) and incremental (event 5012) shapes, and whether
   * payLoad is an array of {dataSource, data/added/updated/removed} blocks or an
   * object keyed by dataSource.
   */
  private ingestAgentStateRows(payload: unknown): void {
    const blocks: Array<{ dataSource?: string; [k: string]: unknown }> = [];
    if (Array.isArray(payload)) {
      for (const b of payload) if (b && typeof b === "object") blocks.push(b as Record<string, unknown>);
    } else if (payload && typeof payload === "object") {
      for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
        if (v && typeof v === "object") blocks.push({ dataSource: k, ...(v as Record<string, unknown>) });
        else blocks.push({ dataSource: k, data: v as unknown });
      }
    }
    for (const block of blocks) {
      if (block.dataSource !== "AGENT_STATE") continue;
      const rows: unknown[] = [];
      for (const key of ["data", "added", "updated", "values", "objects", "rows"]) {
        const v = block[key];
        if (Array.isArray(v)) rows.push(...v);
      }
      for (const raw of rows) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as { id?: string; userId?: string; agentId?: string; state?: string; agentState?: string; callType?: string | null; customer?: string | null; campaignId?: string | null; onCallStateSince?: number };
        const id = r.id ?? r.userId ?? r.agentId;
        if (!id) continue;
        const prev = this.agentCalls.get(id);
        this.agentCalls.set(id, {
          five9UserId: id,
          state: r.state ?? r.agentState ?? prev?.state ?? "UNKNOWN",
          callType: r.callType ?? prev?.callType ?? null,
          customer: r.customer ?? prev?.customer ?? null,
          campaignId: r.campaignId ?? prev?.campaignId ?? null,
          onCallSince: r.onCallStateSince || prev?.onCallSince || null,
          updatedAt: Date.now(),
        });
      }
    }
  }

  private async runForever(): Promise<void> {
    let delay = 2000;
    while (!this.stopping) {
      try {
        await this.connectOnce();
        delay = 2000; // reset backoff after a clean run
      } catch (e) {
        this.status.connected = false;
        this.status.error = e instanceof Error ? e.message : String(e);
        console.error("[supervisor-feed]", this.status.error);
        delay = Math.min(delay * 2, 60000);
      }
      if (this.stopping) break;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  private async login(): Promise<void> {
    const res = await fetch(`${LOGIN_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        passwordCredentials: {
          username: process.env.FIVE9_SUPERVISOR_USERNAME,
          password: process.env.FIVE9_SUPERVISOR_PASSWORD,
        },
        policy: "ForceIn",
      }),
    });
    if (!res.ok) throw new Error(`supervisor login ${res.status}: ${(await res.text()).slice(0, 150)}`);
    this.jar = parseSetCookies(res, hostOf(LOGIN_BASE));
    const j = (await res.json()) as {
      userId: string;
      orgId: string;
      tokenId: string;
      context?: { farmId?: string };
      metadata?: { dataCenters?: Array<{ active?: boolean; apiUrls?: Array<{ host: string; port: string }> }> };
    };
    const dc = j.metadata?.dataCenters?.find((d) => d.active) ?? j.metadata?.dataCenters?.[0];
    const api = dc?.apiUrls?.[0];
    if (!api) throw new Error("supervisor login: no data center URL");
    this.dcHost = api.host;
    this.dcPort = String(api.port);
    this.apiHost = `https://${api.host}:${api.port}/supsvcs/rs/svc`;
    this.userId = j.userId;
    this.orgId = j.orgId;
    this.farmId = j.context?.farmId ?? null;
    this.tokenId = j.tokenId;
  }

  /** Call a /supsvcs/rs/svc path (cookies-only). `under` toggles the /supervisors/{id} prefix. */
  private async svc(path: string, method = "GET", body?: unknown, underSupervisor = true): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookieHeaderFor(this.jar, this.dcHost),
    };
    if (this.farmId) headers.farmid = this.farmId;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const base = underSupervisor ? `${this.apiHost}/supervisors/${this.userId}` : this.apiHost;
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const fresh = parseSetCookies(res, this.dcHost);
    if (fresh.length) this.jar = mergeCookies(this.jar, fresh);
    return res;
  }

  private async driveToWorking(): Promise<void> {
    for (let i = 0; i < 14; i++) {
      const res = await this.svc("/login_state");
      const text = await res.text().catch(() => "");
      if (res.status === 401) continue; // session propagating to the DC node
      if (!res.ok) throw new Error(`supervisor login_state ${res.status}: ${text.slice(0, 150)}`);
      const state = text.trim().replace(/^"|"$/g, "");
      if (state === "WORKING") return;
      if (state === "SELECT_STATION") {
        await this.svc("/session_start?force=true", "PUT", { stationId: "", stationType: "EMPTY" });
        continue;
      }
      if (state === "ACCEPT_NOTICE") {
        const nr = await this.svc("/maintenance_notices");
        const notices = (await nr.json().catch(() => [])) as Array<{ id?: string | number }>;
        for (const n of Array.isArray(notices) ? notices : []) {
          if (n.id != null) await this.svc(`/maintenance_notices/${n.id}/accept`, "PUT").catch(() => undefined);
        }
        continue;
      }
      throw new Error(`supervisor unexpected login state: ${state}`);
    }
    throw new Error("supervisor did not reach WORKING");
  }

  /** Build email -> five9UserId from the domain user list (so we can map a CRM agent to their Five9 id). */
  private async loadDomainUsers(): Promise<void> {
    try {
      const res = await this.svc(`/orgs/${this.orgId}/users`, "GET", undefined, /* underSupervisor */ false);
      if (!res.ok) {
        console.warn("[supervisor-feed] domain users", res.status);
        return;
      }
      const users = (await res.json().catch(() => [])) as Array<{
        id?: string; userName?: string; email?: string; firstName?: string; lastName?: string; fullName?: string;
      }>;
      if (!Array.isArray(users)) return;
      const map = new Map<string, string>();
      // Build name -> id, but DROP any name shared by >1 agent (ambiguous).
      const nameCounts = new Map<string, number>();
      const nameMap = new Map<string, string>();
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
      for (const u of users) {
        if (!u.id) continue;
        if (u.userName) map.set(String(u.userName).toLowerCase(), u.id);
        if (u.email) map.set(String(u.email).toLowerCase(), u.id);
        const full = (u.fullName || [u.firstName, u.lastName].filter(Boolean).join(" ")).trim();
        if (full) {
          const k = norm(full);
          nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
          nameMap.set(k, u.id);
        }
      }
      for (const [k, c] of nameCounts) if (c > 1) nameMap.delete(k); // drop ambiguous names
      if (map.size) this.userIdByEmail = map;
      this.idByFullName = nameMap;
      console.log(`[supervisor-feed] loaded ${map.size} user mappings, ${nameMap.size} unique-name mappings`);
    } catch (e) {
      console.warn("[supervisor-feed] loadDomainUsers failed:", e instanceof Error ? e.message : e);
    }
  }

  private async connectOnce(): Promise<void> {
    await this.login();
    await this.driveToWorking();
    await this.loadDomainUsers();

    const uri = `wss://${this.dcHost}:${this.dcPort}/supsvcs/sws/${SOCKET_KEY}_super`;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(uri, {
        headers: {
          Cookie: cookieHeaderFor(this.jar, this.dcHost),
          Authorization: `Bearer-${this.tokenId}`,
          ...(this.farmId ? { farmid: this.farmId } : {}),
        },
      });
      this.ws = ws;
      let pinger: NodeJS.Timeout | null = null;

      ws.on("open", () => {
        this.status.connected = true;
        this.status.error = undefined;
        console.log("[supervisor-feed] WebSocket open");
        pinger = setInterval(() => {
          try {
            ws.send("ping");
          } catch {
            /* ignore */
          }
        }, 15000);
      });

      ws.on("message", (data) => {
        this.status.lastEvent = Date.now();
        const text = data.toString();
        let event: { context?: { eventId?: string; eventReason?: string }; payLoad?: unknown };
        try {
          event = JSON.parse(text);
        } catch {
          return; // "ping"/non-json
        }
        const eventId = event.context?.eventId ?? null;
        const reason = event.context?.eventReason ?? null;
        this.eventCounts[eventId ?? "none"] = (this.eventCounts[eventId ?? "none"] ?? 0) + 1;
        // Keep a small ring buffer of non-pong messages for diagnosing the live shape.
        if (eventId !== "1202") {
          this.rawLog.push({ at: Date.now(), eventId, reason, preview: text.slice(0, 1200) });
          if (this.rawLog.length > 30) this.rawLog.shift();
        }
        this.ingestAgentStateRows(event.payLoad);
        this.status.agents = this.agentCalls.size;
        this.status.onCall = [...this.agentCalls.values()].filter((a) => a.state === "ON_CALL").length;
      });

      ws.on("error", (e) => {
        this.status.connected = false;
        this.status.error = e.message;
      });
      ws.on("close", () => {
        this.status.connected = false;
        if (pinger) clearInterval(pinger);
        this.ws = null;
        // Resolve so runForever loops and reconnects (with backoff).
        resolve();
      });
      // If it never opens, the 'error'/'close' will reject/resolve.
      ws.on("unexpected-response", (_req, res) => {
        reject(new Error(`supervisor WS handshake ${res.statusCode}`));
      });
    });
  }
}

// Process-wide singleton (the server.js process is persistent on Railway).
const globalForFeed = globalThis as unknown as { __five9SupervisorFeed?: SupervisorFeed };
export const supervisorFeed = globalForFeed.__five9SupervisorFeed ?? new SupervisorFeed();
globalForFeed.__five9SupervisorFeed = supervisorFeed;
