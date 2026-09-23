"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Flag, Maximize, Minimize, Monitor, Settings2, Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import { CELEBRATION_MS, currentScoreboardPeriod, targetPercent, totalScoreboard, type MonthlyCloser, type WinEvent } from "@/lib/scoreboard-shared";
import { Football, playTouchdownSound, Touchdown } from "./touchdown";
import { TargetsEditor } from "./targets-editor";
import { useScoreboard } from "./use-scoreboard";
import "./scoreboard.css";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const number = (n: number) => new Intl.NumberFormat("en-US").format(n);
const monthLabel = (period: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`));
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join(""); }

function Progress({ actual, goal }: { actual: number; goal: number | null }) {
  const pct = targetPercent(actual, goal);
  return <div className={`sb-progress ${pct !== null && pct >= 100 ? "sb-achieved" : ""}`}>
    <strong>{pct === null ? <span className="sb-muted">—</span> : `${Math.round(pct)}%`}{pct !== null && pct >= 100 && <Check size={13} />}</strong>
    <div><i style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} /></div>
  </div>;
}

function CloserRow({ row, rank, leader }: { row: MonthlyCloser; rank: number; leader: boolean }) {
  return <tr className={leader ? "sb-leader" : ""}>
    <td><span className={`sb-rank sb-rank-${rank}`}>{rank === 1 && leader ? <Trophy size={18} /> : String(rank).padStart(2, "0")}</span></td>
    <th scope="row"><div className="sb-closer"><span className="sb-avatar">{initials(row.name)}</span><span><strong>{row.name}</strong><small>{row.tier ? `TIER ${row.tier}` : "CLOSER"}{leader ? " · LEADING THE FIELD" : ""}</small></span></div></th>
    <td className="sb-muted">{row.debtTarget !== null && row.debtTarget > 0 ? money(row.debtTarget) : <span className="sb-no-goal">Not set</span>}</td>
    <td className="sb-debt">{money(row.grossDebt)}</td>
    <td><Progress actual={row.grossDebt} goal={row.debtTarget} /></td>
    <td>{number(row.transfers)}</td>
    <td><strong>{number(row.signed)}</strong>{row.contractTarget !== null && row.contractTarget > 0 && <small className="sb-cell-note">of {number(row.contractTarget)} goal</small>}</td>
    <td className="sb-win-count">{number(row.won)}</td>
    <td><strong>{number(row.paid)}</strong><small className="sb-cell-note">{money(row.paidDebt)}</small></td>
    <td>{money(row.netDebt)}</td>
  </tr>;
}

export function MonthlyScoreboard({ tv = false }: { tv?: boolean }) {
  const [period, setPeriod] = useState(currentScoreboardPeriod);
  const [currentPeriod, setCurrentPeriod] = useState(currentScoreboardPeriod);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const [sound, setSound] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [queue, setQueue] = useState<WinEvent[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const audio = useRef<AudioContext | null>(null);
  const tableArea = useRef<HTMLDivElement | null>(null);
  const soundEnabled = useRef(false);
  const addWins = useCallback((events: WinEvent[]) => { setQueue((old) => [...old, ...events]); setRevision((old) => old + 1); }, []);
  const { data, error, feedError } = useScoreboard(period, tv && period === currentPeriod, revision, addWins);
  const event = queue[0];
  const dismiss = useCallback(() => setQueue((old) => old.slice(1)), []);
  const rows = data?.rows ?? [];
  const totals = totalScoreboard(rows);
  const pageCount = tv ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const rowsPerPage = tv ? Math.ceil(rows.length / pageCount) : rows.length;
  const activePage = page % pageCount;
  const visibleRows = tv ? rows.slice(activePage * rowsPerPage, (activePage + 1) * rowsPerPage) : rows;
  const completeGoals = rows.length > 0 && totals.targetCount === rows.length;

  useEffect(() => {
    const timer = setInterval(() => { const month = currentScoreboardPeriod(); setCurrentPeriod(month); if (tv) setPeriod(month); }, 30_000);
    return () => clearInterval(timer);
  }, [tv]);
  useEffect(() => {
    if (!tv) return;
    const area = tableArea.current;
    if (!area) return;
    const resize = () => {
      const head = area.querySelector("thead")?.getBoundingClientRect().height ?? 47;
      const foot = area.querySelector("tfoot")?.getBoundingClientRect().height ?? 47;
      setPageSize(Math.min(15, Math.max(1, Math.floor((area.clientHeight - head - foot) / 50))));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(area); resize();
    return () => observer.disconnect();
  }, [tv]);
  useEffect(() => {
    if (pageCount <= 1 || event) return;
    const timer = setInterval(() => setPage((old) => (old + 1) % pageCount), 20_000);
    return () => clearInterval(timer);
  }, [pageCount, event]);
  const eventId = event?.id;
  useEffect(() => {
    if (!eventId) return;
    if (soundEnabled.current && audio.current) playTouchdownSound(audio.current);
    const timer = setTimeout(dismiss, CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [eventId, dismiss]);
  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", changed);
    return () => { document.removeEventListener("fullscreenchange", changed); void audio.current?.close(); };
  }, []);

  async function toggleSound() {
    if (sound) { soundEnabled.current = false; setSound(false); return; }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      soundEnabled.current = true; setSound(true); setNotice("");
    } catch { setNotice("Sound is unavailable in this browser. The animation will still play."); }
  }
  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); setNotice(""); }
    catch { setNotice("Use your browser’s full-screen control to fill the TV."); }
  }
  function testTouchdown() {
    setQueue((old) => [...old, { id: `demo-${Date.now()}`, opportunityId: "demo", closerId: rows[0]?.userId ?? "demo", closerName: rows[0]?.name ?? "Your next champion", debt: 125_000, at: new Date().toISOString(), demo: true }]);
  }

  return <section className={`sb-board ${tv ? "sb-tv" : "sb-hub"}`} aria-label="Monthly closers scoreboard">
    <div className="sb-stadium-lights" aria-hidden="true" />
    <header className="sb-header">
      <div className="sb-brand"><div className="sb-brand-icon"><Trophy /></div><div><div className="sb-eyebrow">COASTAL DEBT · THE CLOSERS CLUB</div><h1>Every close counts<span>.</span></h1></div></div>
      <div className="sb-header-right"><div className="sb-period">{tv ? <span>{monthLabel(period)}</span> : <label><span className="sr-only">Scoreboard month</span><input type="month" value={period} min="2000-01" max="2099-12" onChange={(e) => { if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) setPeriod(e.target.value); }} /></label>}<span className={`sb-live ${error || feedError ? "sb-reconnecting" : ""}`}><i />{error || feedError ? "RECONNECTING" : period === currentPeriod ? "LIVE" : "MONTHLY VIEW"}</span></div>
        <div className="sb-controls">
          {!tv && <><a href="/scoreboard/tv" target="_blank" rel="noopener noreferrer" className="sb-button sb-button-gold"><Monitor size={15} /> Open TV display <ArrowUpRight size={14} /></a>{data?.canManage && <button className="sb-button" onClick={() => setEditing(true)} disabled={!rows.length}><Settings2 size={15} /> Monthly goals</button>}</>}
          <button className={`sb-button ${sound ? "sb-sound-on" : ""}`} onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound {sound ? "on" : "off"}</button>
          <button className="sb-button" onClick={testTouchdown} disabled={queue.length > 5}><Zap size={15} /> Test touchdown</button>
          {tv && <><button className="sb-button" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}{fullscreen ? "Exit full screen" : "Full screen"}</button><Link className="sb-button sb-back" href="/floor-manager/scoreboard">Back to hub</Link></>}
        </div>
      </div>
    </header>

    {(error || feedError || notice) && <div className="sb-alert" role="status">{error || feedError || notice}{error.includes("session expired") && <a href="/login">Sign in</a>}{data && error && <span>Showing the last successful update.</span>}</div>}

    <div className="sb-stats">
      <div className="sb-stat sb-stat-main"><span>GROSS DEBT ENROLLED</span><strong>{data ? money(totals.debt) : "—"}</strong><small>{completeGoals ? `${Math.round(targetPercent(totals.debt, totals.target) ?? 0)}% of ${money(totals.target)} team goal` : totals.targetCount ? `${totals.targetCount} of ${rows.length} closer goals configured` : "Set monthly goals to track team progress"}</small><div className="sb-stat-ball"><Football /></div></div>
      <div className="sb-stat"><span>CONTRACTS SIGNED</span><strong>{data ? number(totals.signed) : "—"}<small>deals</small></strong><small>{number(totals.transfers)} monthly transfers</small></div>
      <div className="sb-stat"><span>CLOSED WON</span><strong>{data ? number(totals.won) : "—"}<Flag size={23} /></strong><small>Keep moving the chains</small></div>
      <div className="sb-stat"><span>FIRST PAYMENT DEBT</span><strong>{data ? money(totals.paidDebt) : "—"}</strong><small>{number(totals.paid)} first payments completed</small></div>
    </div>

    <div className="sb-table-panel">
      <div className="sb-table-heading"><h2><span /> Monthly closer standings</h2><span>RANKED BY GROSS DEBT <span className="sb-dot">·</span> {rows.length} CLOSERS</span></div>
      <div className="sb-table-scroll" ref={tableArea}><table className="sb-table"><caption className="sr-only">Monthly closer production for {monthLabel(period)}, ranked by gross signed debt</caption><thead><tr><th scope="col">Rank</th><th scope="col">Closer</th><th scope="col">Monthly goal</th><th scope="col">Gross debt</th><th scope="col">Goal hit</th><th scope="col">Transfers</th><th scope="col">Signed</th><th scope="col">Won</th><th scope="col">1st paid</th><th scope="col">Net debt</th></tr></thead>
        <tbody>{!data ? <tr><td colSpan={10} className="sb-empty">{error ? "Waiting for the scoreboard to reconnect…" : "Getting the field ready…"}</td></tr> : !rows.length ? <tr><td colSpan={10} className="sb-empty">Add your team in <Link href="/floor-manager/closers">Closer Setup</Link> to start the scoreboard.</td></tr> : visibleRows.map((row, i) => <CloserRow key={row.userId} row={row} rank={activePage * rowsPerPage + i + 1} leader={activePage === 0 && i === 0 && row.grossDebt > 0} />)}</tbody>
        {rows.length > 0 && <tfoot><tr><th colSpan={2}>TEAM TOTALS</th><td>{completeGoals ? money(totals.target) : "—"}</td><td>{money(totals.debt)}</td><td>{completeGoals ? `${Math.round(targetPercent(totals.debt, totals.target) ?? 0)}%` : "—"}</td><td>{number(totals.transfers)}</td><td>{number(totals.signed)}</td><td>{number(totals.won)}</td><td>{number(totals.paid)}</td><td>{money(totals.netDebt)}</td></tr></tfoot>}
      </table></div>
    </div>

    <footer className="sb-footer"><span><i className="sb-status-dot" />{data ? `UPDATED ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(data.generatedAt))} ET` : "CONNECTING"}<span className="sb-dot">·</span>REFRESHES EVERY 8 SEC</span>
      {pageCount > 1 ? <div className="sb-pages"><button onClick={() => setPage((old) => (old + pageCount - 1) % pageCount)} aria-label="Previous closers"><ChevronLeft size={16} /></button><span>PAGE {activePage + 1} OF {pageCount} · AUTO ROTATES</span><button onClick={() => setPage((old) => (old + 1) % pageCount)} aria-label="Next closers"><ChevronRight size={16} /></button></div> : <span className="sb-footer-motto"><Football /> ONE TEAM. EVERY YARD.</span>}
      {!tv && <button onClick={() => setDetails((old) => !old)} aria-expanded={details}>{details ? "Hide" : "View"} full metrics & definitions</button>}
      {tv && <span>NEW CLOSED WON → TOUCHDOWN{queue.length > 1 ? ` · ${queue.length - 1} UP NEXT` : ""}</span>}
    </footer>

    {!tv && details && <div className="sb-details">
      <h3>The full picture</h3><div className="sb-table-scroll"><table className="sb-table"><thead><tr><th>Closer</th><th>Contracts out</th><th>Signed / goal</th><th>Canceled</th><th>Canceled debt</th><th>First paid debt / goal</th><th>First paid goal hit</th></tr></thead><tbody>{rows.map((row) => <tr key={row.userId}><th>{row.name}</th><td>{row.contractsOut}</td><td>{row.signed} / {row.contractTarget ?? "—"}</td><td>{row.canceled}</td><td>{money(row.canceledDebt)}</td><td>{money(row.paidDebt)} / {row.firstPaymentDebtTarget ? money(row.firstPaymentDebtTarget) : "—"}</td><td><Progress actual={row.paidDebt} goal={row.firstPaymentDebtTarget} /></td></tr>)}</tbody></table></div>
      <p>Months use Eastern time. Transfers are opportunities created this month and currently assigned to the closer. Signed production uses the first contract signing date, with recorded stage history, close date, then creation date as fallbacks. Gross debt includes canceled signed deals; net debt subtracts signed deals now canceled, lost, or archived. Won and first paid reflect the current stage of that month’s signed deals. Contracts out are this month’s transfers currently in a Contract Sent stage.</p>
      <p>The TV celebrates newly recorded transitions into Closed Won, once per event, and queues simultaneous wins. Opening a new TV session starts from now. Keep the TV tab open and signed in. Sound starts off; use the sound toggle to enable the touchdown fanfare.</p>
    </div>}
    {editing && data && <TargetsEditor rows={data.rows} period={period} onClose={() => setEditing(false)} onSaved={() => setRevision((old) => old + 1)} />}
    {event && <Touchdown key={event.id} event={event} onDismiss={dismiss} />}
  </section>;
}
