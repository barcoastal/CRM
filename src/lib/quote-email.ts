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
  // Trust band. Sourced from the company's public Trustpilot standing; swap
  // ratingBadge/ratingSource to "A+" / "BBB Accredited" only if the business
  // actually holds that grade.
  ratingBadge: "Excellent",
  ratingSource: "Rated on Trustpilot",
  reviewStars: 5,
  reviewCount: "400+",
  // Real verified client reviews pulled from coastaldebt.com/testimonials
  // (2026-08-19). Lightly cleaned for punctuation only.
  testimonials: [
    {
      quote:
        "Sarah is phenomenal! She is always keeping me informed on any updates and showing support while being attentive to any concerns or questions I have. She has been a guiding light and I'm so pleased with my services!",
      name: "Alisa Taylor",
      location: "Verified client review",
    },
    {
      quote:
        "Coastal has been there as promised every step of the way and took care of everything without us having to worry about what was being accomplished and when we would see results. Alecha kept in touch with me weekly and was always easy to reach when needed.",
      name: "Jerome Armstead Jr.",
      location: "Verified client review",
    },
    {
      quote:
        "Timothy has been awesome helping me through this tough time in my business. He is very attentive and answers all of my questions. I highly recommend Coastal Debt Resolve to my colleagues.",
      name: "Jamari Nicholas",
      location: "Verified client review",
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
  const base = appBaseUrl();
  const logo = `${base}/email/coastal-logo.png`;
  const tpBadge = `${base}/email/trustpilot-badge.png`;
  const bbbBadge = `${base}/email/bbb-badge.png`;
  const font =
    "'Aeonik','Helvetica Neue',Helvetica,Arial,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const m = QUOTE_MARKETING;
  const stars = "&#9733;".repeat(m.reviewStars);
  const phone = args.callPhone || "(888) 707-7177";
  const forName = args.businessName ? esc(args.businessName) : "your business";

  const paymentRow = (label: string, value: string, strong = false) =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f8;font-family:${font};font-size:14px;color:#475467;">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f8;font-family:${font};font-size:14px;color:#0b0b14;font-weight:${strong ? 800 : 600};text-align:right;">${esc(value)}</td>
    </tr>`;

  const benefit = (icon: string, title: string, text: string) =>
    `<tr>
      <td width="46" valign="top" style="padding:10px 0;">
        <div style="width:38px;height:38px;border-radius:10px;background:#E9F2FF;text-align:center;line-height:38px;font-size:18px;">${icon}</div>
      </td>
      <td valign="top" style="padding:10px 0 10px 12px;">
        <div style="font-family:${font};font-size:15px;font-weight:700;color:#0b0b14;">${esc(title)}</div>
        <div style="font-family:${font};font-size:13px;line-height:1.55;color:#475467;">${esc(text)}</div>
      </td>
    </tr>`;

  const step = (n: number, title: string, text: string) =>
    `<tr>
      <td width="40" valign="top" style="padding:8px 0;">
        <div style="width:30px;height:30px;border-radius:50%;background:#0B5CAB;color:#fff;text-align:center;line-height:30px;font-family:${font};font-size:14px;font-weight:800;">${n}</div>
      </td>
      <td valign="top" style="padding:8px 0 8px 12px;">
        <div style="font-family:${font};font-size:14px;font-weight:700;color:#0b0b14;">${esc(title)}</div>
        <div style="font-family:${font};font-size:13px;line-height:1.5;color:#475467;">${esc(text)}</div>
      </td>
    </tr>`;

  const note = args.note
    ? `<tr><td style="padding:0 32px 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F4F9;border-radius:10px;">
          <tr><td style="padding:14px 18px;font-family:${font};font-size:14px;line-height:1.6;color:#1a1a2e;"><div style="color:#0B5CAB;font-weight:700;margin-bottom:2px;">A note from ${esc(args.senderName || "your advisor")}</div><div style="white-space:pre-wrap;">${esc(args.note)}</div></td></tr>
        </table>
      </td></tr>`
    : "";

  const testimonialBlock = m.testimonials
    .slice(0, 3)
    .map(
      (t) => `<tr><td style="padding:0 0 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;border:1px solid #e7ecf3;box-shadow:0 1px 2px rgba(16,24,40,0.04);">
          <tr><td style="padding:16px 18px;">
            <div style="font-family:${font};font-size:14px;color:#00B67A;letter-spacing:2px;margin-bottom:6px;">${stars}</div>
            <div style="font-family:${font};font-size:14px;line-height:1.6;color:#1a1a2e;">&ldquo;${esc(t.quote)}&rdquo;</div>
            <div style="font-family:${font};font-size:12px;color:#667085;margin-top:8px;font-weight:600;">${esc(t.name)} <span style="font-weight:400;color:#98a2b3;">&middot; ${esc(t.location)}</span></div>
          </td></tr>
        </table>
      </td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="margin:0;padding:0;background:#EEF2F8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F8;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e8f5;box-shadow:0 6px 24px rgba(16,24,40,0.08);">

          <!-- Site-style header bar -->
          <tr>
            <td style="padding:16px 32px;border-bottom:1px solid #eef1f8;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td valign="middle"><img src="${logo}" alt="Coastal Debt Resolve" width="180" style="display:block;width:180px;height:auto;border:0;"/></td>
                <td valign="middle" align="right" style="font-family:${font};">
                  <div style="font-size:11px;color:#98a2b3;text-transform:uppercase;letter-spacing:0.5px;">Speak to a specialist</div>
                  <a href="tel:${esc(phone)}" style="font-size:16px;font-weight:800;color:#0B5CAB;text-decoration:none;">${esc(phone)}</a>
                </td>
              </tr></table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td bgcolor="#0B5CAB" style="background:linear-gradient(135deg,#1B96FF,#0B5CAB);padding:34px 32px;text-align:center;">
              <div style="font-family:${font};font-size:12px;font-weight:700;letter-spacing:1px;color:#cfe4ff;text-transform:uppercase;">Your personalized quote for ${forName}</div>
              <div style="font-family:${font};font-size:17px;color:#eaf3ff;margin:14px 0 2px;">You could save an estimated</div>
              <div style="font-family:${font};font-size:52px;line-height:1.05;font-weight:800;color:#ffffff;">${money(f.youSave)}</div>
              <div style="font-family:${font};font-size:15px;color:#eaf3ff;margin-top:2px;">about ${f.savingsPercent}% off your ${money(f.enrolledDebt)} in enrolled debt</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:20px;"><tr>
                <td style="background:#ffffff;border-radius:8px;"><a href="mailto:?subject=I%20want%20to%20move%20forward%20with%20Coastal%20Debt" style="display:inline-block;padding:14px 34px;font-family:${font};font-size:15px;font-weight:800;color:#0B5CAB;text-decoration:none;">Reply &ldquo;YES&rdquo; to get started</a></td>
              </tr></table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr><td style="padding:24px 32px 4px;">
            <p style="margin:0 0 6px;font-family:${font};font-size:15px;line-height:1.65;color:#1a1a2e;">Hi ${esc(first)},</p>
            <p style="margin:0;font-family:${font};font-size:15px;line-height:1.65;color:#1a1a2e;">Based on the debt you shared with us, here is what your program could look like.</p>
          </td></tr>

          ${note}

          <!-- Breakdown card -->
          <tr><td style="padding:16px 32px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAFBFE;border:1px solid #eef1f8;border-radius:12px;">
              <tr><td style="padding:6px 18px 12px;">
                <div style="font-family:${font};font-size:13px;font-weight:700;color:#0b0b14;padding:12px 0 4px;">Your estimated plan</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${paymentRow("Enrolled debt today", money(f.enrolledDebt))}
                  ${paymentRow("Estimated program cost", money(f.programCost))}
                  ${paymentRow("You keep (estimated savings)", money(f.youSave), true)}
                  ${paymentRow("Estimated weekly payment", money(f.weeklyPayment))}
                  ${paymentRow("Estimated monthly payment", money(f.monthlyPayment))}
                  ${paymentRow("Program length", `${f.programMonths} months`)}
                  ${f.weeklySaving != null && f.weeklySaving > 0 ? paymentRow("Lower than you pay now, each week", money(f.weeklySaving), true) : ""}
                </table>
                <div style="font-family:${font};font-size:11px;color:#98a2b3;padding-top:8px;">Figures are estimates based on the information you provided and may change after a full review.</div>
              </td></tr>
            </table>
          </td></tr>

          <!-- Benefits -->
          <tr><td style="padding:20px 32px 4px;">
            <div style="font-family:${font};font-size:17px;font-weight:800;color:#0b0b14;margin-bottom:4px;">Why business owners choose Coastal</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${benefit("&#128176;", "One affordable payment", "We consolidate the daily and weekly drafts draining your cash flow into a single, manageable payment.")}
              ${benefit("&#128737;&#65039;", "Protection from aggressive collection", "Our team steps in with your funders so you can focus on running your business, not fielding calls.")}
              ${benefit("&#9989;", "Real results, real savings", "A clear plan to resolve your balances for less than you owe, with no surprises.")}
            </table>
          </td></tr>

          <!-- Trust logos -->
          <tr><td style="padding:18px 32px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F9FC;border:1px solid #eef1f8;border-radius:12px;">
              <tr>
                <td width="55%" align="center" style="padding:16px 10px;border-right:1px solid #e7ecf3;">
                  <img src="${tpBadge}" alt="Trustpilot - Rated Excellent, 400+ verified reviews" width="240" style="display:block;width:240px;height:auto;border:0;margin:0 auto;"/>
                </td>
                <td width="45%" align="center" style="padding:16px 10px;">
                  <img src="${bbbBadge}" alt="BBB Accredited Business - Rating A+" width="190" style="display:block;width:190px;height:auto;border:0;margin:0 auto;"/>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Testimonials -->
          <tr><td style="padding:20px 32px 4px;">
            <div style="font-family:${font};font-size:17px;font-weight:800;color:#0b0b14;margin-bottom:12px;">What our clients say</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${testimonialBlock}</table>
          </td></tr>

          <!-- How it works -->
          <tr><td style="padding:14px 32px 4px;">
            <div style="font-family:${font};font-size:17px;font-weight:800;color:#0b0b14;margin-bottom:8px;">How it works</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${step(1, "Review your quote", "Reply to this email or call us and we'll confirm the details of your plan.")}
              ${step(2, "Enroll in minutes", "We handle the paperwork and set up one simple payment that fits your budget.")}
              ${step(3, "We resolve your debt", "Our team negotiates on your behalf while you get back to business.")}
            </table>
          </td></tr>

          <!-- Final CTA -->
          <tr><td style="padding:20px 32px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0B5CAB" style="background:linear-gradient(135deg,#1B96FF,#0B5CAB);border-radius:12px;">
              <tr><td align="center" style="padding:22px 20px;">
                <div style="font-family:${font};font-size:18px;font-weight:800;color:#ffffff;">Ready to lower your payments?</div>
                <div style="font-family:${font};font-size:13px;color:#eaf3ff;margin:4px 0 14px;">Reply to this email, or call us and we'll take it from here.</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
                  <td style="background:#ffffff;border-radius:8px;"><a href="tel:${esc(phone)}" style="display:inline-block;padding:13px 30px;font-family:${font};font-size:15px;font-weight:800;color:#0B5CAB;text-decoration:none;">Call ${esc(phone)}</a></td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>

          <!-- Disclaimer -->
          <tr><td style="padding:8px 32px 28px;">
            <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#98a2b3;">
              This quote is an estimate based on the information you provided and typical program results. Individual results vary and are not guaranteed. Coastal Debt Resolve is not a lender, law firm, or credit repair organization. Enrolling in a debt resolution program and stopping payments to creditors may have financial and legal consequences. Please read your program agreement carefully.
            </p>
          </td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;">
          <tr><td style="padding:16px 24px 8px;text-align:center;">
            <p style="margin:0 0 4px;font-family:${font};font-size:12px;font-weight:700;color:#1a1a2e;">Coastal Debt Resolve &middot; ${esc(phone)}</p>
            <p style="margin:0;font-family:${font};font-size:11px;line-height:1.6;color:#98a2b3;">We walk with you from first call to final payment.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
