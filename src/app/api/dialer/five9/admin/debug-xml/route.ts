/**
 * Returns the exact SOAP body we'd send to Five9 for addRecordToList,
 * without actually calling the API. Lets us see if listAddMode is being
 * rendered correctly without depending on Five9's error response.
 */
import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { XMLBuilder } from "fast-xml-parser";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const SER_NS = "http://service.admin.ws.five9.com/";

export async function GET() {
  const r = await requireAuthOrRespond("Lead.Read");
  if ("response" in r) return r.response;

  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_", suppressEmptyNode: false });

  const inner = {
    listName: "Bar_Test",
    listUpdateSettings: {
      fieldsMapping: [
        { columnNumber: 1, fieldName: "number1", key: true },
        { columnNumber: 2, fieldName: "first_name", key: false },
        { columnNumber: 3, fieldName: "last_name", key: false },
        { columnNumber: 4, fieldName: "email", key: false },
        { columnNumber: 5, fieldName: "state", key: false },
      ],
      cleanListBeforeUpdate: false,
      listAddMode: "ADD_FIRST",
      crmAddMode: "ADD_NEW",
      crmUpdateMode: "UPDATE_FIRST",
    },
    record: { fields: ["+19048810033", "Bar", "Elezra", "", ""] },
  };

  const envelope: Record<string, unknown> = {
    "@_xmlns:soapenv": SOAP_NS,
    "@_xmlns:ser": SER_NS,
    "soapenv:Body": {
      "ser:addRecordToList": inner,
    },
  };

  const xml = builder.build({ "soapenv:Envelope": envelope });
  return new NextResponse(xml, { headers: { "content-type": "application/xml" } });
}
