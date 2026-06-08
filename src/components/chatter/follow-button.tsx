"use client";

import { useEffect, useState } from "react";

interface Props {
  groupId?: string;
  entityType?: string;
  entityId?: string;
  initialFollowing?: boolean;
}

export function FollowButton({ groupId, entityType, entityId, initialFollowing }: Props) {
  const [following, setFollowing] = useState<boolean>(initialFollowing ?? false);
  const [loading, setLoading] = useState<boolean>(initialFollowing === undefined);

  useEffect(() => {
    if (initialFollowing !== undefined) return;
    const qs = groupId
      ? `?groupId=${encodeURIComponent(groupId)}`
      : `?entityType=${encodeURIComponent(entityType ?? "")}&entityId=${encodeURIComponent(entityId ?? "")}`;
    fetch(`/api/chatter/follow${qs}`)
      .then((r) => r.ok ? r.json() : { following: false })
      .then((j) => { setFollowing(!!j.following); setLoading(false); })
      .catch(() => setLoading(false));
  }, [groupId, entityType, entityId, initialFollowing]);

  async function toggle() {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (groupId) payload.groupId = groupId;
      else if (entityType && entityId) { payload.entityType = entityType; payload.entityId = entityId; }
      const res = await fetch("/api/chatter/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const j = await res.json();
        setFollowing(!!j.following);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        padding: "5px 12px",
        background: following ? "#fff" : "#0070d2",
        color: following ? "#0070d2" : "#fff",
        border: "1px solid #0070d2",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        cursor: loading ? "default" : "pointer",
      }}
    >
      {loading ? "..." : following ? "Following" : "Follow"}
    </button>
  );
}
