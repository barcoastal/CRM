"use client";

import { useState } from "react";
import { PostComposer } from "@/components/chatter/post-composer";
import { PostFeed, type FeedPost } from "@/components/chatter/post-feed";

interface Group {
  id: string;
  name: string;
}

interface Props {
  initialPosts: FeedPost[];
  currentUserId: string;
  myGroups: Group[];
}

export function ChatterLanding({ initialPosts, currentUserId, myGroups }: Props) {
  const [posts, setPosts] = useState(initialPosts);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(myGroups[0]?.id ?? "");

  async function reload() {
    try {
      const res = await fetch("/api/chatter/feed?limit=30");
      if (!res.ok) return;
      const j = await res.json();
      setPosts(j.items ?? []);
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ border: "1px solid #d8dde6", borderRadius: 6, background: "#fff", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: "#3e3e3c", fontWeight: 500 }}>
            Post to:
          </span>
          {myGroups.length > 0 ? (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              style={{
                padding: "4px 8px",
                border: "1px solid #d8dde6",
                borderRadius: 4,
                fontSize: 13,
                background: "#fff",
              }}
            >
              {myGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12, color: "#706e6b" }}>Join a group to post.</span>
          )}
        </div>
        {selectedGroupId && (
          <PostComposer
            key={selectedGroupId}
            groupId={selectedGroupId}
            onPosted={reload}
          />
        )}
      </div>

      <PostFeed posts={posts} currentUserId={currentUserId} onRefresh={reload} />
    </div>
  );
}
