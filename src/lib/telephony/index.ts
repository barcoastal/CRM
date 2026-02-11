import { MockTelephonyProvider } from "./mock-provider";
import type { TelephonyProvider } from "./types";

const globalForTelephony = globalThis as unknown as {
  telephonyProvider: TelephonyProvider;
};

export function getTelephonyProvider(): TelephonyProvider {
  if (!globalForTelephony.telephonyProvider) {
    // Future: check process.env.TELEPHONY_PROVIDER for 'twilio'
    globalForTelephony.telephonyProvider = new MockTelephonyProvider();
  }
  return globalForTelephony.telephonyProvider;
}

export * from "./types";
