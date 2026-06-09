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
  private userIdByEmail = new Map<string, string>(); // lowercased email -> five9UserId
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
      const users = (await res.json().catch(() => [])) as Array<{ id?: string; userName?: string; email?: string }>;
      if (!Array.isArray(users)) return;
      const map = new Map<string, string>();
      for (const u of users) {
        if (!u.id) continue;
        if (u.userName) map.set(String(u.userName).toLowerCase(), u.id);
        if (u.email) map.set(String(u.email).toLowerCase(), u.id);
      }
      if (map.size) this.userIdByEmail = map;
      console.log(`[supervisor-feed] loaded ${map.size} domain user mappings`);
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
        let event: { payLoad?: unknown };
        try {
          event = JSON.parse(data.toString());
        } catch {
          return; // "ping"/non-json
        }
        const payload = event.payLoad;
        if (!Array.isArray(payload)) return;
        for (const block of payload as Array<{ dataSource?: string; data?: unknown[]; added?: unknown[]; updated?: unknown[] }>) {
          if (block.dataSource !== "AGENT_STATE") continue;
          const rows = [...(block.data ?? []), ...(block.added ?? []), ...(block.updated ?? [])] as Array<{
            id?: string;
            state?: string;
            callType?: string | null;
            customer?: string | null;
            campaignId?: string | null;
            onCallStateSince?: number;
          }>;
          for (const r of rows) {
            if (!r.id) continue;
            this.agentCalls.set(r.id, {
              five9UserId: r.id,
              state: r.state ?? "UNKNOWN",
              callType: r.callType ?? null,
              customer: r.customer ?? null,
              campaignId: r.campaignId ?? null,
              onCallSince: r.onCallStateSince || null,
              updatedAt: Date.now(),
            });
          }
        }
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
