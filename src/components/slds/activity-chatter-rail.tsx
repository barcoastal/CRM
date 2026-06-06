"use client";

import { useState } from "react";
import { ActivityRail, type ActivityItem } from "./activity-rail";

export type ChatterPost = {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date;
  replies?: ChatterPost[];
};

export function ActivityChatterRail({
  activities,
  chatter,
}: {
  activities: readonly ActivityItem[];
  chatter: readonly ChatterPost[];
}) {
  const [tab, setTab] = useState<"Activity" | "Chatter">("Activity");

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
        marginBottom: 12,
        boxShadow: "0 2px 2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #d8dde6",
          padding: "0 8px",
        }}
      >
        {(["Activity", "Chatter"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "transparent",
                border: 0,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                color: active ? "#080707" : "#3e3e3c",
                borderBottom: active ? "3px solid #0070d2" : "3px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 8 }}>
        {tab === "Activity" ? (
          <ActivityRail items={activities} />
        ) : (
          <ChatterFeed posts={chatter} />
        )}
      </div>
    </div>
  );
}

function ChatterFeed({ posts }: { posts: readonly ChatterPost[] }) {
  const [body, setBody] = useState("");
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
      }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid #f3f3f3" }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share an update…"
          style={{
            width: "100%",
            minHeight: 56,
            border: "1px solid #d8dde6",
            borderRadius: 4,
            padding: 8,
            fontSize: 13,
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
          <button
            style={{
              background: "#0070d2",
              color: "#fff",
              border: 0,
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: body ? "pointer" : "not-allowed",
              opacity: body ? 1 : 0.5,
            }}
          >
            Share
          </button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: "#706e6b" }}>
          No Chatter activity yet. Be the first to post an update.
        </div>
      ) : (
        posts.map((p) => <ChatterPostView key={p.id} post={p} />)
      )}
    </article>
  );
}

function ChatterPostView({ post }: { post: ChatterPost }) {
  return (
    <div style={{ padding: 12, borderBottom: "1px solid #f3f3f3" }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#5b94d5",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {post.authorName.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{post.authorName}</div>
          <div style={{ fontSize: 11, color: "#706e6b" }}>
            {post.createdAt.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap" }}>{post.body}</div>
        </div>
      </div>
      {post.replies && post.replies.length > 0 && (
        <div style={{ marginLeft: 42, marginTop: 8, borderLeft: "2px solid #f3f3f3", paddingLeft: 10 }}>
          {post.replies.map((r) => (
            <ChatterPostView key={r.id} post={r} />
          ))}
        </div>
      )}
    </div>
  );
}
