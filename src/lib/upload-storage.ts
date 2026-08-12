import path from "path";

/**
 * Client-document upload storage. On Railway the persistent volume is
 * mounted at /data (same as e-sign storage); the container filesystem is
 * wiped on every deploy, so uploads MUST NOT live under process.cwd().
 */
export function uploadRoot(sub: "opportunities" | "leads" | "accounts"): string {
  const base =
    process.env.UPLOAD_DIR ??
    (process.env.NODE_ENV === "production"
      ? "/data/uploads"
      : path.join(process.cwd(), "uploads"));
  return path.join(base, sub);
}
