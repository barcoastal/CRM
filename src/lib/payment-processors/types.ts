/**
 * Common interface for all payment processors (RAM, SAS, Reliant, …).
 *
 * Each provider implements:
 *  - getEscrowBalance(externalId)            — current dollar balance for an account
 *  - listUpdatedBalances(sinceISO)           — bulk-fetch all balances updated since a timestamp
 *  - getDraftUpdates(sinceISO)               — pull recent draft status changes
 *
 * The orchestrator in src/lib/payment-processors/index.ts loops Accounts
 * with the matching external ID, fetches per provider, and writes back.
 */

export interface DraftUpdate {
  /** External id of the draft as known to the processor */
  externalDraftId: string;
  /** External id of the account/customer */
  externalAccountId: string;
  /** Normalized status: SCHEDULED | PROCESSING | SUCCESS | FAILED | CANCELLED */
  status: string;
  amount?: number | null;
  scheduledDate?: string | null;
  processedAt?: string | null;
  settledAt?: string | null;
  returnCode?: string | null;
  returnReason?: string | null;
  /** SF record id of the draft (SAS DebitRemoteID) - secondary match key. */
  sfDraftId?: string | null;
}

export interface BalanceUpdate {
  externalAccountId: string;
  balance: number;
  pulledAt: Date;
  /** SF account id (SAS remoteid) - secondary match key. */
  sfAccountId?: string | null;
}

export interface PaymentProcessor {
  readonly name: "RAM" | "SAS" | "RELIANT";

  /** Single-account fetch (used when SAS Account is loaded one-at-a-time). */
  getEscrowBalance(externalId: string): Promise<number | null>;

  /**
   * Bulk fetch: returns balances for any account updated on the processor
   * side since `sinceISO`. Used by the cron sync.
   */
  listUpdatedBalances(sinceISO: string): Promise<BalanceUpdate[]>;

  /** Bulk fetch: draft status changes since `sinceISO`. */
  getDraftUpdates(sinceISO: string): Promise<DraftUpdate[]>;
}
