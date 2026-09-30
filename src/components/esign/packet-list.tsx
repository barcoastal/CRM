"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function PacketList() {
  const [items, setItems] = useState<
    { id: string; name: string; status: string; createdAt: string }[]
  >([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/esign/packets")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Unable to load packets");
        setItems(d.items ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 6,
        marginBottom: 20,
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 16, marginBottom: 10 }}>My signing packets</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : items.length ? (
        items.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              gap: 20,
              padding: "10px 0",
              borderTop: "1px solid #eee",
            }}
          >
            <Link
              href={`/envelopes/packets/${p.id}`}
              style={{ color: "#0176d3", flex: 1 }}
            >
              {p.name}
            </Link>
            <span>{p.status}</span>
            <span>{new Date(p.createdAt).toLocaleDateString()}</span>
          </div>
        ))
      ) : (
        <p>Create a packet with Send documents. Saved drafts appear here.</p>
      )}
    </section>
  );
}
