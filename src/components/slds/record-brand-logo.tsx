import Image from "next/image";

export function RecordBrandLogo({ brand }: { brand: string | null }) {
  const normalized = brand?.trim().toLowerCase();
  return (
    <div title={brand ? `Brand: ${brand}` : "Brand not set"} style={{ flexShrink: 0, alignSelf: "center", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "4px 10px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6 }}>
      {normalized === "coastal debt" ? (
        <Image src="/brand/coastal-debt-logo.svg" alt="Coastal Debt" width={154} height={28} unoptimized />
      ) : normalized === "bdi" ? (
        <span style={{ position: "relative", display: "block", width: 64, height: 44, overflow: "hidden" }}>
          <Image src="/brand/bdi-logo.png" alt="BDI" width={132} height={132} unoptimized style={{ position: "absolute", maxWidth: "none", width: 132, height: 132, left: -35, top: -43 }} />
        </span>
      ) : <span style={{ fontSize: 12, color: "#5c6470" }}>{brand || "Brand not set"}</span>}
    </div>
  );
}
