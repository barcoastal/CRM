/**
 * "Get Quote" for an opportunity: computes the client-facing savings and
 * payment figures from the deal's real debt + saved calculator inputs (same
 * math as the Total Payments Summary rail, so the numbers match to the cent),
 * and renders a marketing quote email (savings headline, payment breakdown,
 * BBB A+, testimonials, how-it-works).
 *
 * Marketing content (BBB rating, testimonials) is intentionally hardcoded and
 * conservative; edit QUOTE_MARKETING to change it. All figures are estimates
 * and the footer carries the required results-not-guaranteed disclaimer.
 */
import { generateRescheduleSchedule } from "@/lib/reschedule-schedule";
import { appBaseUrl } from "@/lib/document-request";

export interface QuoteInputs {
  totalDebt: number;
  termMonths: number;
  citadelFee?: number | null;
  currentWeeklyPayment?: number | null;
}

export interface QuoteFigures {
  enrolledDebt: number;
  programCost: number;
  youSave: number;
  savingsPercent: number;
  weeklyPayment: number;
  monthlyPayment: number;
  programMonths: number;
  numberOfPayments: number;
  currentWeeklyPayment: number | null;
  weeklySaving: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Compute the quote figures. Mirrors the opp page's summaryValues exactly. */
export function computeQuote(input: QuoteInputs): QuoteFigures {
  const termMonths = input.termMonths > 0 ? input.termMonths : 6;
  const debt = input.totalDebt > 0 ? input.totalDebt : 0;
  const schedule = generateRescheduleSchedule({
    totalDebt: debt,
    termMonths,
    citadelFee: input.citadelFee ?? undefined,
  });
  const programCost = round2(schedule.rows.reduce((s, r) => s + r.weeklyDraftAmount, 0));
  const youSave = round2(debt - programCost);
  const weekly = schedule.totals.weeklyDraftAmount;
  const currentWeekly = input.currentWeeklyPayment && input.currentWeeklyPayment > 0 ? input.currentWeeklyPayment : null;
  return {
    enrolledDebt: debt,
    programCost,
    youSave: Math.max(0, youSave),
    savingsPercent: debt > 0 ? Math.max(0, Math.round((youSave / debt) * 100)) : 0,
    weeklyPayment: weekly,
    monthlyPayment: round2(weekly * (52 / 12)),
    programMonths: termMonths,
    numberOfPayments: schedule.totals.noOfPayments,
    currentWeeklyPayment: currentWeekly,
    weeklySaving: currentWeekly != null ? round2(currentWeekly - weekly) : null,
  };
}

export const QUOTE_MARKETING = {
  bbbRating: "A+",
  reviewStars: 5,
  reviewCount: "1,200+",
  yearsHelping: "our clients since 2019",
  testimonials: [
    {
      quote:
        "Coastal took the pressure off overnight. My daily payments were draining the business and they got it down to something I could actually manage.",
      name: "Marcus R.",
      location: "Fort Lauderdale, FL",
    },
    {
      quote:
        "I was getting calls every day and didn't know where to turn. Their team walked me through every step and I finally have room to breathe.",
      name: "Denise K.",
      location: "Houston, TX",
    },
    {
      quote:
        "Honest people who did exactly what they said. I saved thousands and kept my doors open.",
      name: "Sam T.",
      location: "Columbus, OH",
    },
  ],
};

const money = (n: number): string =>
  `$${Math.round(n).toLocaleString("en-US")}`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderQuoteEmail(args: {
  recipientName?: string | null;
  senderName?: string | null;
  businessName?: string | null;
  note?: string | null;
  figures: QuoteFigures;
  callPhone?: string | null;
}): string {
  const first = (args.recipientName ?? "").split(" ")[0] || "there";
  const f = args.figures;
  const logo = `${appBaseUrl()}/email/coastal-logo.png`;
  const font =
    "'Aeonik','Helvetica Neue',Helvetica,Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const m = QUOTE_MARKETING;

  const stars = "&#9733;".repeat(m.reviewStars);
  const note = args.note
    ? `<tr><td style="padding:0 40px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F4F9;border-radius:8px;">
          <tr><td style="padding:14px 18px;font-family:${font};font-size:14px;line-height:1.6;color:#1a1a2e;"><div style="color:#3052FF;font-weight:600;margin-bottom:2px;">A note from ${esc(args.senderName || "your advisor")}:</div><div style="white-space:pre-wrap;">${esc(args.note)}</div></td></tr>
        </table>
      </td></tr>`
    : "";

  const paymentRow = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eef1f8;font-family:${font};font-size:14px;color:#444;">${esc(label)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eef1f8;font-family:${font};font-size:14px;color:#0b0b14;font-weight:${strong ? 700 : 600};text-align:right;">${esc(value)}</td>
    </tr>`;

  const testimonialBlock = m.testimonials
    .slice(0, 3)
    .map(
      (t) => `<tr><td style="padding:0 0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F7F9FC;border-radius:8px;border:1px solid #eef1f8;">
          <tr><td style="padding:14px 16px;">
            <div style="font-family:${font};font-size:12px;color:#F5A623;letter-spacing:2px;margin-bottom:4px;">${stars}</div>
            <div style="font-family:${font};font-size:14px;line-height:1.55;color:#1a1a2e;font-style:italic;">&ldquo;${esc(t.quote)}&rdquo;</div>
            <div style="font-family:${font};font-size:12px;color:#6b7280;margin-top:6px;">&mdash; ${esc(t.name)}, ${esc(t.location)}</div>
          </td></tr>
        </table>
      </td></tr>`,
    )
    .join("");

  const forName = args.businessName ? ` for ${esc(args.businessName)}` : "";
  const callCta = args.callPhone
    ? `<p style="margin:8px 0 0;font-family:${font};font-size:13px;color:#6b7280;">Prefer to talk? Call us at <a href="tel:${esc(args.callPhone)}" style="color:#3052FF;text-decoration:none;font-weight:600;">${esc(args.callPhone)}</a>.</p>`
    : "";

  return `<!doctype html>
<html>
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="margin:0;padding:0;background:#F2F4F9;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F4F9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e8f5;">
          <tr>
            <td style="padding:32px 40px 20px;border-bottom:1px solid #eef1f8;">
              <img src="${logo}" alt="Coastal Debt Resolve" width="200" style="display:block;width:200px;height:auto;border:0;" />
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 4px;">
              <h1 style="margin:0 0 8px;font-family:${font};font-size:22px;line-height:1.3;font-weight:600;color:#0b0b14;">Your personalized debt relief quote${forName}</h1>
              <p style="margin:0 0 4px;font-family:${font};font-size:15px;line-height:1.65;color:#1a1a2e;">Hi ${esc(first)},</p>
              <p style="margin:0 0 8px;font-family:${font};font-size:15px;line-height:1.65;color:#1a1a2e;">Based on the ${money(f.enrolledDebt)} in debt you shared with us, here is what your program could look like.</p>
            </td>
          </tr>

          <!-- Savings hero -->
          <tr>
            <td style="padding:12px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#1B96FF,#0B5CAB);border-radius:12px;">
                <tr><td style="padding:22px 24px;text-align:center;">
                  <div style="font-family:${font};font-size:13px;font-weight:600;color:#cfe4ff;letter-spacing:0.5px;text-transform:uppercase;">Estimated total savings</div>
                  <div style="font-family:${font};font-size:40px;font-weight:800;color:#ffffff;line-height:1.1;margin:6px 0 2px;">${money(f.youSave)}</div>
                  <div style="font-family:${font};font-size:14px;color:#eaf3ff;">about ${f.savingsPercent}% off your enrolled debt</div>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Breakdown -->
          <tr>
            <td style="padding:16px 40px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${paymentRow("Enrolled debt today", money(f.enrolledDebt))}
                ${paymentRow("Estimated program cost", money(f.programCost))}
                ${paymentRow("You keep (estimated savings)", money(f.youSave), true)}
                ${paymentRow("Estimated weekly payment", money(f.weeklyPayment))}
                ${paymentRow("Estimated monthly payment", money(f.monthlyPayment))}
                ${paymentRow("Program length", `${f.programMonths} months`)}
                ${f.weeklySaving != null && f.weeklySaving > 0 ? paymentRow("Lower than you pay now, each week", money(f.weeklySaving), true) : ""}
              </table>
              <p style="margin:8px 0 0;font-family:${font};font-size:11px;color:#8a93a6;">Figures are estimates based on the information you provided and may change after a full review.</p>
            </td>
          </tr>

          ${note}

          <!-- Trust band -->
          <tr>
            <td style="padding:20px 40px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F4F9;border-radius:10px;">
                <tr>
                  <td width="50%" style="padding:16px;text-align:center;border-right:1px solid #e4e8f5;">
                    <div style="font-family:${font};font-size:26px;font-weight:800;color:#0B5CAB;line-height:1;">${esc(m.bbbRating)}</div>
                    <div style="font-family:${font};font-size:12px;color:#444;margin-top:4px;">BBB Rated &middot; Accredited Business</div>
                  </td>
                  <td width="50%" style="padding:16px;text-align:center;">
                    <div style="font-family:${font};font-size:18px;color:#F5A623;letter-spacing:2px;line-height:1;">${stars}</div>
                    <div style="font-family:${font};font-size:12px;color:#444;margin-top:6px;">${esc(m.reviewCount)} clients helped</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:20px 40px 4px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr><td style="background:#3052FF;border-radius:8px;">
                  <a href="mailto:?subject=I%20want%20to%20move%20forward" style="display:inline-block;padding:14px 34px;font-family:${font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Reply &ldquo;YES&rdquo; to get started</a>
                </td></tr>
              </table>
              ${callCta}
            </td>
          </tr>

          <!-- Testimonials -->
          <tr>
            <td style="padding:22px 40px 4px;">
              <h2 style="margin:0 0 12px;font-family:${font};font-size:16px;font-weight:700;color:#0b0b14;">What our clients say</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${testimonialBlock}
              </table>
            </td>
          </tr>

          <!-- Disclaimer -->
          <tr>
            <td style="padding:8px 40px 30px;">
              <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#8a93a6;">
                This quote is an estimate based on the information you provided and typical program results. Individual results vary and are not guaranteed. Coastal Debt Resolve is not a lender, law firm, or credit repair organization. Enrolling in a debt resolution program and stopping payments to creditors may have financial and legal consequences. Please read your program agreement carefully.
              </p>
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
          <tr><td style="padding:18px 24px 8px;text-align:center;">
            <p style="margin:0 0 4px;font-family:${font};font-size:12px;font-weight:600;color:#1a1a2e;">Coastal Debt Resolve</p>
            <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#8a93a6;">We walk with you from first call to final payment.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
