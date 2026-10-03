import PizZip from "pizzip";

/** Repair known DocuSign-conversion artifacts in a copy of the master template.
 * Original uploaded templates and previously generated packets are untouched.
 */
export function salesforceMasterTemplate(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Invalid contract template.");
  const xml = file.asText();
  const clean = xml.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, (run) =>
    run.replace(/"\s*\/&gt;\s*#&gt;/g, ""),
  ).replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
    const text = row.replace(/<[^>]*>/g, "");
    if (text.includes("TOTAL WEEKLY PAYMENT"))
      row = row.replaceAll("{{FirstPaymentAmount}}", "{{WeeklyPayment}}");
    if (text.includes("{{#Creditors}}") && text.includes("{{AccountNumber}}"))
      row = row.replace(/(<w:t(?:\s[^>]*)?>)TBD(<\/w:t>)/g, "$1$2");
    return row;
  });
  if (clean === xml) return buffer;
  zip.file("word/document.xml", clean);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
