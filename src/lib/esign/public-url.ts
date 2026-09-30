/** Public document links are independent of authentication/provider hostnames. */
export function esignPublicUrl(): string {
  return (process.env.ESIGN_PUBLIC_URL ?? "https://crm.coastaldebt-tools.com").replace(/\/$/, "");
}
