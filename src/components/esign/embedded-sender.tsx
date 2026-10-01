"use client";
import { useEffect, useState, useRef } from "react";
import { PacketWizard } from "./packet-wizard";
const parentOrigin = "https://cdcrm--newdocusig.sandbox.lightning.force.com";
export function EmbeddedSender({ id }: { id: string }) {
  const credential = useRef("");
  const [embedded, setEmbedded] = useState<{
    token: string;
    pdfUrl: string;
    onClose: () => void;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const token = credential.current || window.location.hash.slice(1);
    credential.current = token;
    history.replaceState(null, "", window.location.pathname);
    if (!token || window.parent === window) {
      queueMicrotask(() => setError("Open Coastal Sign from the Salesforce Opportunity."));
      return;
    }
    let active = true;
    let url = "";
    fetch(`/api/esign/packets/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Session unavailable. Close and reopen Coastal Sign in Salesforce.",
          );
        url = URL.createObjectURL(await r.blob());
        if (active)
          setEmbedded({
            token,
            pdfUrl: url,
            onClose: () =>
              window.parent.postMessage(
                { type: "coastal-sign-close" },
                parentOrigin,
              ),
          });
        else URL.revokeObjectURL(url);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (error)
    return (
      <p role="alert" style={{ padding: 32 }}>
        {error}
      </p>
    );
  if (!embedded) return <p style={{ padding: 32 }}>Loading Coastal Sign…</p>;
  return <PacketWizard packetId={id} embedded={embedded} />;
}
