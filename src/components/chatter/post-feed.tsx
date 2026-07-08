"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { renderHtml } from "@/lib/chatter/mentions";
import { PostComposer } from "./post-composer";

type ReactionRow = { id: string; userId: string; emoji: string };

export interface FeedPost {
  id: string;
  body: string;
  createdAt: string;
  groupId: string | null;
  entityType: string | null;
  entityId: string | null;
  author: { id: string; name: string; email: string; avatar?: string | null };
  group?: { id: string; name: string } | null;
  reactions: ReactionRow[];
  _count: { replies: number };
}

interface Props {
  posts: FeedPost[];
  currentUserId: string;
  onRefresh?: () => void;
}

const REACTION_EMOJI: Record<string, string> = {
  like: "Like",
  love: "Love",
  laugh: "Haha",
};

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function recordHref(p: FeedPost): string | null {
  if (p.groupId) return `/chatter/groups/${p.groupId}`;
  if (p.entityType && p.entityId) {
    const t = p.entityType.toLowerCase();
    const map: Record<string, string> = {
      lead: "leads", account: "accounts", contact: "contacts",
      opportunity: "opportunities", client: "clients", case: "cases",
      task: "tasks", event: "events", programplan: "program-plans",
      offer: "offers", settlement: "settlements", creditor: "creditors",
    };
    const path = map[t] ?? `${t}s`;
    return `/${path}/${p.entityId}`;
  }
  return null;
}

function recordLabel(p: FeedPost): string | null {
  if (p.group?.name) return p.group.name;
  if (p.entityType) return `${p.entityType}`;
  return null;
}

export function PostFeed({ posts: initialPosts, currentUserId, onRefresh }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  useEffect(() => { setPosts(initialPosts); }, [initialPosts]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {posts.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#747474", border: "1px dashed #c9c9c9", borderRadius: 6 }}>
          No posts yet. Be the first to share.
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} currentUserId={currentUserId} onChanged={onRefresh} />
      ))}
    </div>
  );
}

function PostCard({ post, currentUserId, onChanged }: { post: FeedPost; currentUserId: string; onChanged?: () => void }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<FeedPost[] | null>(null);
  const [reactions, setReactions] = useState(post.reactions);
  const [busy, setBusy] = useState(false);
  const href = recordHref(post);
  const label = recordLabel(post);
  const myReaction = reactions.find((r) => r.userId === currentUserId)?.emoji ?? null;

  async function react(emoji: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chatter/posts/${post.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.removed) {
          setReactions((rs) => rs.filter((r) => r.userId !== currentUserId));
        } else {
          setReactions((rs) => {
            const without = rs.filter((r) => r.userId !== currentUserId);
            return [...without, { id: j.id, userId: currentUserId, emoji }];
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadReplies() {
    if (replies !== null) return;
    try {
      const res = await fetch(`/api/chatter/posts/${post.id}`);
      if (!res.ok) return;
      const full = await res.json();
      setReplies(full.replies ?? []);
    } catch {
      // ignore
    }
  }

  function toggleReplies() {
    const next = !showReplies;
    setShowReplies(next);
    if (next) loadReplies();
  }

  const counts: Record<string, number> = {};
  for (const r of reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;

  const initials = post.author.name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <div style={{ border: "1px solid #c9c9c9", borderRadius: 6, background: "#fff", padding: 14 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <span style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "#181818", color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {initials || "U"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <Link href={`/settings/users/${post.author.id}`} style={{ fontSize: 13, fontWeight: 600, color: "#181818", textDecoration: "none" }}>
              {post.author.name}
            </Link>
            {label && href && (
              <>
                <span style={{ color: "#747474", fontSize: 12 }}>in</span>
                <Link href={href} style={{ fontSize: 12, color: "#0176d3", textDecoration: "none" }}>
                  {label}
                </Link>
              </>
            )}
            <span style={{ color: "#747474", fontSize: 11 }}>{formatRelative(post.createdAt)}</span>
          </div>
          <div
            className="chatter-body"
            style={{ fontSize: 14, lineHeight: 1.5, color: "#181818", wordBreak: "break-word" }}
            dangerouslySetInnerHTML={{ __html: renderHtml(post.body) }}
          />

          <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
            {["like", "love", "laugh"].map((emoji) => (
              <button
                key={emoji}
                onClick={() => react(emoji)}
                disabled={busy}
                style={{
                  background: myReaction === emoji ? "#e0f0ff" : "transparent",
                  border: "1px solid",
                  borderColor: myReaction === emoji ? "#0176d3" : "#c9c9c9",
                  borderRadius: 12,
                  padding: "3px 10px",
                  fontSize: 11,
                  color: myReaction === emoji ? "#0176d3" : "#444444",
                  cursor: "pointer",
                  display: "inline-flex",
                  gap: 4,
                  alignItems: "center",
                }}
              >
                {REACTION_EMOJI[emoji] ?? emoji}
                {(counts[emoji] ?? 0) > 0 && <span style={{ fontWeight: 600 }}>{counts[emoji]}</span>}
              </button>
            ))}
            <button
              onClick={toggleReplies}
              style={{
                background: "transparent",
                border: 0,
                color: "#0176d3",
                fontSize: 12,
                cursor: "pointer",
                padding: "3px 6px",
              }}
            >
              {post._count.replies > 0 ? `${post._count.replies} repl${post._count.replies === 1 ? "y" : "ies"}` : "Reply"}
            </button>
          </div>

          {showReplies && (
            <div style={{ marginTop: 12, paddingLeft: 8, borderLeft: "2px solid #ecebea", display: "flex", flexDirection: "column", gap: 8 }}>
              {replies && replies.length > 0 && replies.map((rp) => (
                <ReplyRow key={rp.id} post={rp} />
              ))}
              <PostComposer
                parentId={post.id}
                placeholder="Write a reply..."
                onPosted={() => { loadReplies(); onChanged?.(); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyRow({ post }: { post: FeedPost }) {
  const initials = post.author.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "#181818", color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>
        {initials || "U"}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
          <Link href={`/settings/users/${post.author.id}`} style={{ fontSize: 12, fontWeight: 600, color: "#181818", textDecoration: "none" }}>
            {post.author.name}
          </Link>
          <span style={{ color: "#747474", fontSize: 11 }}>{formatRelative(post.createdAt)}</span>
        </div>
        <div
          style={{ fontSize: 13, lineHeight: 1.45, color: "#181818", wordBreak: "break-word" }}
          dangerouslySetInnerHTML={{ __html: renderHtml(post.body) }}
        />
      </div>
    </div>
  );
}
