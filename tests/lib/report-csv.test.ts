import { expect, it } from "vitest";
import { reportCsv } from "@/lib/reports/csv";
it("exports ordered columns, escaped text, nulls and safe spreadsheet values", () => {
  expect(reportCsv({ columns: [{ key: "name", label: "Name" }, { key: "amount", label: "Amount" }], rows: [{ name: 'a,"b"\nc', amount: -5 }, { name: '=HYPERLINK("x")', amount: null }], rowCount: 2 })).toBe('"Name","Amount"\r\n"a,""b""\nc","-5"\r\n"\'=HYPERLINK(""x"")",""');
});
