/**
 * AI contract analysis for uploaded client documents (MCA funding agreements,
 * loan contracts). Sends the file to Gemini with a structured response schema
 * and returns the extraction. Uses the CRM's own GEMINI_API_KEY.
 */

export interface ContractAnalysis {
  docType: string;
  funderName: string | null;
  merchantName: string | null;
  agreementDate: string | null;
  fundingAmount: number | null;
  paybackAmount: number | null;
  factorRate: number | null;
  paymentAmount: number | null;
  paymentFrequency: string | null;
  estimatedTermDays: number | null;
  hasConfessionOfJudgment: boolean;
  hasPersonalGuarantee: boolean;
  hasUccFilingClause: boolean;
  fees: string[];
  defaultClauses: string[];
  redFlags: string[];
  summary: string;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    docType: { type: "STRING", description: "e.g. MCA Agreement, Term Loan, Bank Statement, Settlement Offer, Other" },
    funderName: { type: "STRING", nullable: true },
    merchantName: { type: "STRING", nullable: true, description: "The business receiving funding" },
    agreementDate: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    fundingAmount: { type: "NUMBER", nullable: true, description: "Purchase price / amount funded in USD" },
    paybackAmount: { type: "NUMBER", nullable: true, description: "Purchased amount / total payback in USD" },
    factorRate: { type: "NUMBER", nullable: true, description: "payback divided by funding, e.g. 1.49" },
    paymentAmount: { type: "NUMBER", nullable: true, description: "Per-payment remittance in USD" },
    paymentFrequency: { type: "STRING", nullable: true, description: "Daily, Weekly, Bi-Weekly, Monthly" },
    estimatedTermDays: { type: "NUMBER", nullable: true },
    hasConfessionOfJudgment: { type: "BOOLEAN" },
    hasPersonalGuarantee: { type: "BOOLEAN" },
    hasUccFilingClause: { type: "BOOLEAN" },
    fees: { type: "ARRAY", items: { type: "STRING" }, description: "Origination, ACH, default fees etc with amounts" },
    defaultClauses: { type: "ARRAY", items: { type: "STRING" }, description: "Key default/acceleration triggers, short" },
    redFlags: { type: "ARRAY", items: { type: "STRING" }, description: "Terms unusually hostile to the merchant" },
    summary: { type: "STRING", description: "3-5 plain-language sentences for a settlement negotiator" },
  },
  required: [
    "docType",
    "hasConfessionOfJudgment",
    "hasPersonalGuarantee",
    "hasUccFilingClause",
    "fees",
    "defaultClauses",
    "redFlags",
    "summary",
  ],
} as const;

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function mimeForFile(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

export async function analyzeContract(file: Buffer, mimeType: string): Promise<ContractAnalysis> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured on this environment.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "You are a contract analyst for a merchant cash advance (MCA) debt settlement firm.",
                  "Analyze the attached document. It is usually an MCA funding agreement, loan contract,",
                  "bank statement or settlement offer uploaded by a client. Extract the requested fields.",
                  "Amounts are USD numbers without symbols. When a field is not present use null.",
                  "redFlags: call out confession of judgment, personal guarantees, aggressive default",
                  "interest, fee stacking, reconciliation traps and similar merchant-hostile terms.",
                  "The summary is for the settlement negotiator working this file.",
                ].join(" "),
              },
              { inlineData: { mimeType, data: file.toString("base64") } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(120000),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no analysis.");
  return JSON.parse(text) as ContractAnalysis;
}
