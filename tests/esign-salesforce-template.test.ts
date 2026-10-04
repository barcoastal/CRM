import { expect, it } from "vitest";
import PizZip from "pizzip";
import { salesforceMasterTemplate } from "@/lib/esign/salesforce/template";
it("repairs only legacy conversion residue and the weekly summary binding", () => {
  const zip = new PizZip();
  zip.file("word/document.xml", `<w:document><w:body><w:p><w:r><w:t>{{ClientCity}}\"/&gt; #&gt;, {{ClientState}}</w:t></w:r></w:p><w:p><w:t>Program deposit {{FirstRetainerSetupFee}}; {{ProgramFeePercent}}; {{RetainerPercent}}%; total {{TotalFeePercent}}</w:t></w:p><w:p><w:t>$55.00 weekly Administrative processing fee</w:t></w:p><w:tbl><w:tr><w:tc><w:t>TOTAL WEEKLY PAYMENT *</w:t></w:tc><w:tc><w:t>{{FirstPaymentAmount}}</w:t></w:tc></w:tr><w:tr><w:tc><w:t>{{#Creditors}}\" /&gt; #&gt;{{Balance}}</w:t></w:tc><w:tc><w:t>{{AccountNumber}}</w:t><w:t>TBD</w:t><w:t>{{/Creditors}}</w:t></w:tc></w:tr></w:tbl><w:p><w:t>First payment {{FirstPaymentAmount}}. Unrelated TBD stays.</w:t></w:p></w:body></w:document>`);
  zip.file("word/styles.xml", "unchanged styles");
  const source=zip.generate({type:"nodebuffer"});
  const repaired=new PizZip(salesforceMasterTemplate(source));
  const xml=repaired.file("word/document.xml")!.asText();
  expect(xml).not.toContain("#&gt;");
  expect(xml).toContain("{{WeeklyPayment}}");
  expect(xml).toContain("Program deposit {{FirstPaymentAmount}}");
  expect(xml).toContain("{{ProgramFeePercentDisplay}}");
  expect(xml).toContain("{{RetainerPercentDisplay}};");
  expect(xml).toContain("{{TotalProgramPercentDisplay}}");
  expect(xml).toContain("{{ServiceFee}} weekly Administrative processing fee");
  expect(xml).toContain("First payment {{FirstPaymentAmount}}");
  expect(xml).not.toContain("<w:t>TBD</w:t>");
  expect(xml).toContain("Unrelated TBD stays.");
  expect(repaired.file("word/styles.xml")!.asText()).toBe("unchanged styles");
  expect(new PizZip(source).file("word/document.xml")!.asText()).toContain("#&gt;");
  const stable=salesforceMasterTemplate(source);
  expect(salesforceMasterTemplate(stable)).toBe(stable);
});

import { salesforceRamTemplate } from "@/lib/esign/salesforce/template";
import { readFileSync } from "node:fs";
it("replaces both RAM hard-coded marks and releases clipped table rows", () => {
  const result = salesforceRamTemplate(readFileSync("docs/contract-templates/PROCESSOR_RAM.docx"));
  const xml = new PizZip(result).file("word/document.xml")!.asText();
  expect(xml).toContain("{{BankIsChecking}}");
  expect(xml).toContain("{{BankIsSavings}}");
  expect(xml).not.toContain("EndConditional");
  expect(xml).not.toContain('w:hRule="exact"');
  expect(xml).toContain("{{FirstPaymentDate}}");
});
