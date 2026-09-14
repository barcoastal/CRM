import { NextResponse } from "next/server";
import { redactSsn } from "@/lib/ssn-privacy";

/** Ordinary record responses never disclose full SSNs, including to admins. */
export const ssnSafeJson: typeof NextResponse.json = (body, init) =>
  NextResponse.json(redactSsn(body), init);
