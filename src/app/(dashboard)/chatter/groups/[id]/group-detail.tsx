"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PostComposer } from "@/components/chatter/post-composer";
import { PostFeed, type FeedPost } from "@/components/chatter/post-feed";
import { FollowButton } from "@/components/chatter/follow-button";

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  owner: { id: string; name: string; email: string } | null;
  memberCount: number;
  postCount: number;
}

interface Props {
  group: GroupInfo;
  currentUserId: string;
  isMember: boolean;
  myRole: string | null;
  isFollowing: boolean;
  initialPosts: FeedPost[];
}

export function GroupDetail({ group, currentUserId, isMember, myRole, isFollowing, initialPosts }: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [joining, setJoining] = useState(false);
  const [member, setMember] = useState(isMember);

  async function reload() {
    try {
      const res = await fetch(`/api/chatter/groups/${group.id}/feed?limit=30`);
      if (!res.ok) return;
      const j = await res.json();
      const enriched = (j.items ?? []).map((p: FeedPost) => ({ ...p, group: { id: group.id, name: group.name } }));
      setPosts(enriched);
    } catch {
      // ignore
    }
  }

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await fetch(`/api/chatter/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, role: "member" }),
      });
      if (res.ok) {
        setMember(true);
        router.refresh();
      }
    } finally {
      setJoining(false);
    }
  }

  const initials = group.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 12, color: "#747474" }}>
        <Link href="/chatter" style={{ color: "#0176d3", textDecoration: "none" }}>Chatter</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href="/chatter/groups" style={{ color: "#0176d3", textDecoration: "none" }}>Groups</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span>{group.name}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 18, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 6, marginBottom: 16 }}>
        <span style={{
          width: 56, height: 56, borderRadius: 6, background: "#181818",
          color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 700, flexShrink: 0,
        }}>
          {initials || "G"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>{group.name}</h1>
          <div style={{ fontSize: 12, color: "#747474", marginTop: 4 }}>
            {group.visibility === "private" ? "Private" : "Public"}
            {" · "}{group.memberCount} members
            {" · "}{group.postCount} posts
            {group.owner && <> {" · "} Owner: {group.owner.name}</>}
          </div>
          {group.description && (
            <div style={{ fontSize: 13, color: "#444444", marginTop: 6, lineHeight: 1.45 }}>
              {group.description}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {!member && group.visibility === "public" && (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                padding: "5px 12px",
                background: "#0176d3",
                color: "#fff",
                border: "1px solid #0176d3",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                cursor: joining ? "default" : "pointer",
              }}
            >
              {joining ? "Joining..." : "Join Group"}
            </button>
          )}
          {currentUserId && (
            <FollowButton groupId={group.id} initialFollowing={isFollowing} />
          )}
        </div>
      </div>

      {member ? (
        <div style={{ marginBottom: 16 }}>
          <PostComposer groupId={group.id} onPosted={reload} />
        </div>
      ) : (
        <div style={{ marginBottom: 16, padding: 14, border: "1px dashed #c9c9c9", borderRadius: 6, color: "#747474", fontSize: 13 }}>
          {group.visibility === "public"
            ? "Join this group to post."
            : "You must be invited to post in this private group."}
        </div>
      )}

      <PostFeed posts={posts} currentUserId={currentUserId} onRefresh={reload} />
    </div>
  );
}
