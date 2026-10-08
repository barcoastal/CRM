import Image from "next/image";

export function RecordBrandLogo({ brand }: { brand: string | null }) {
  const normalized = brand?.trim().toLowerCase();
  return (
    <div title={brand ? `Brand: ${brand}` : "Brand not set"} style={{ flexShrink: 0, alignSelf: "center", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "4px 10px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6 }}>
      {normalized === "coastal debt" ? (
        <Image src="/brand/coastal-debt-logo.svg" alt="Coastal Debt" width={154} height={28} unoptimized />
      ) : normalized === "bdi" ? (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Image src="/brand/bdi-icon.svg" alt="" width={32} height={32} unoptimized />
          <Image src="/brand/bdi-wordmark.svg" alt="Business Debt Insider" width={128} height={32} unoptimized />
        </span>
      ) : <span style={{ fontSize: 12, color: "#5c6470" }}>{brand || "Brand not set"}</span>}
    </div>
  );
}
