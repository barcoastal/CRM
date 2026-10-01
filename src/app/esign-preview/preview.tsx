"use client";
import { useState } from "react";
import { SignClient } from "@/app/sign/[token]/sign-client";
import { PacketWizard } from "@/components/esign/packet-wizard";
import { type PacketConfig } from "@/lib/esign/packet-config";
const common = { x: 80, y: 240, width: 155, height: 34 };
const groups = {
  signatureBoxes: [
    { ...common, page: 1 },
    { ...common, page: 3 },
  ],
  initialBoxes: [{ ...common, width: 60, page: 2 }],
  dateBoxes: [{ ...common, y: 170, width: 120, height: 18, page: 1 }],
  textBoxes: [
    { ...common, y: 290, height: 20, page: 1, label: "Full name" },
    { ...common, y: 290, height: 20, page: 3, label: "Full name" },
    {
      ...common,
      y: 220,
      height: 14,
      width: 65,
      page: 1,
      label: "Agreement day",
    },
    {
      ...common,
      x: 170,
      y: 220,
      height: 14,
      width: 75,
      page: 1,
      label: "Agreement month",
    },
    { ...common, y: 205, height: 14, page: 3, label: "Business name" },
    { ...common, y: 222, height: 14, page: 3, label: "Title" },
  ],
  checkboxBoxes: [],
};
const initial: PacketConfig = {
  documents: [
    { id: "sample", name: "Sample test document", startPage: 1, pageCount: 3 },
  ],
  recipients: [
    {
      id: "qa",
      name: "Preview User",
      email: "preview@example.test",
      action: "SIGN",
      order: 1,
    },
  ],
  fields: groups.signatureBoxes.map((b, i) => ({
    ...b,
    id: `s${i}`,
    kind: "signature",
    recipientId: "qa",
    required: true,
  })),
  subject: "Test preview",
  message: "This sample is for interface testing only.",
  reminderDays: 1,
  expiresDays: 30,
};
export function Preview() {
  const [mode, setMode] = useState("signer");
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 100,
          background: "#fff",
          border: "1px solid #ccc",
          padding: 2,
          fontSize: 10,
        }}
      >
        Local preview · no emails or contracts{" "}
        <button
          onClick={() => setMode(mode === "signer" ? "editor" : "signer")}
        >
          {mode === "signer" ? "Sender wizard" : "Signer view"}
        </button>
      </div>
      {mode === "signer" ? (
        <SignClient
          {...groups}
          token="preview"
          envelopeId="preview"
          signerName="Preview User"
          signerEmail="preview@example.test"
          documentName="Sample test document"
          templateName="Sample"
          senderName="Coastal Debt"
          message="Interface test only. This sample is not a contract."
          previewUrl="/api/esign/preview/pdf"
        />
      ) : (
        <PacketWizard
          preview={{ config: initial, pdfUrl: "/api/esign/preview/pdf" }}
        />
      )}
    </>
  );
}
