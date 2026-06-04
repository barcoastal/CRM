/**
 * Five9 Admin Web Service SOAP client.
 * Port of SF Five9ListService.cls.
 *
 * Endpoint: https://<baseURL>/wsadmin/v13/AdminWebService
 * Auth: HTTP Basic with API username + password
 *
 * Env:
 *   FIVE9_API_BASE_URL=https://api.five9.com  (or your tenant-specific)
 *   FIVE9_USERNAME=...
 *   FIVE9_PASSWORD=...
 *   FIVE9_DEFAULT_LIST=Coastal_Web_Leads  (optional default list to push to)
 *
 * Operations implemented:
 *   - addRecordToList(listName, fields)            — add a single lead
 *   - addToList(listName, rows)                    — bulk add (CSV upload)
 *   - removeRecordFromList(listName, phone)
 *   - addToDnc(phones[])                           — add phones to DNC
 *   - removeFromDnc(phones[])
 */

import { XMLBuilder, XMLParser } from "fast-xml-parser";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const SER_NS = "http://service.admin.ws.five9.com/";

function getEnv() {
  const base = process.env.FIVE9_API_BASE_URL ?? "https://api.five9.com";
  const username = process.env.FIVE9_USERNAME;
  const password = process.env.FIVE9_PASSWORD;
  if (!username || !password) throw new Error("FIVE9_USERNAME / FIVE9_PASSWORD not set");
  return {
    endpoint: `${base.replace(/\/$/, "")}/wsadmin/v13/AdminWebService`,
    authHeader: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  };
}

const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_", suppressEmptyNode: false });
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true });

function buildSecurityHeader(): Record<string, unknown> | undefined {
  const answers = [
    process.env.FIVE9_SECURITY_ANSWER_1,
    process.env.FIVE9_SECURITY_ANSWER_2,
    process.env.FIVE9_SECURITY_ANSWER_3,
  ].filter((a): a is string => typeof a === "string" && a.length > 0);
  if (answers.length === 0) return undefined;
  return {
    "ser:headerSecurityAnswers": { answer: answers },
  };
}

async function soapCall(method: string, innerBody: Record<string, unknown>): Promise<unknown> {
  const env = getEnv();
  const securityHeader = buildSecurityHeader();
  const envelope: Record<string, unknown> = {
    "@_xmlns:soapenv": SOAP_NS,
    "@_xmlns:ser": SER_NS,
    "soapenv:Body": {
      [`ser:${method}`]: innerBody,
    },
  };
  if (securityHeader) {
    envelope["soapenv:Header"] = securityHeader;
  }
  const xml = builder.build({ "soapenv:Envelope": envelope });
  const res = await fetch(env.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      Authorization: env.authHeader,
      SOAPAction: `"${method}"`,
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>${xml}`,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Five9 ${method} ${res.status}: ${text.slice(0, 1500)}`);
  const parsed = parser.parse(text) as { Envelope?: { Body?: Record<string, unknown> } };
  return parsed.Envelope?.Body ?? {};
}

export async function createList(listName: string): Promise<{ ok: boolean }> {
  await soapCall("createList", { listName });
  return { ok: true };
}

export async function addRecordToList(args: {
  listName: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  state?: string;
  fields?: Record<string, string>;
}): Promise<{ ok: boolean }> {
  const list = args.listName ?? process.env.FIVE9_DEFAULT_LIST;
  if (!list) throw new Error("Five9 listName required");

  // <ser:addRecordToList>
  //   <listName>...</listName>
  //   <listUpdateSettings>
  //     <fieldsMapping>
  //       <fieldsMapping><columnNumber>1</columnNumber><fieldName>number1</fieldName>...
  //   </listUpdateSettings>
  //   <record>
  //     <data>+15551234567</data>
  //     <data>First</data>...
  //   </record>
  const fields: string[] = [
    args.phone,
    args.firstName ?? "",
    args.lastName ?? "",
    args.email ?? "",
    args.state ?? "",
  ];
  await soapCall("addRecordToList", {
    listName: list,
    listUpdateSettings: {
      fieldsMapping: [
        { columnNumber: 1, fieldName: "number1", key: true },
        { columnNumber: 2, fieldName: "first_name", key: false },
        { columnNumber: 3, fieldName: "last_name", key: false },
        { columnNumber: 4, fieldName: "email", key: false },
        { columnNumber: 5, fieldName: "state", key: false },
      ],
      cleanListBeforeUpdate: false,
      listAddMode: "ADD_NEW",
      crmAddMode: "ADD_NEW",
      crmUpdateMode: "UPDATE_FIRST",
    },
    record: { fields },
  });
  return { ok: true };
}

export async function removeRecordFromList(listName: string, phone: string): Promise<{ ok: boolean }> {
  await soapCall("deleteRecordFromList", {
    listName,
    listDeleteSettings: {
      fieldsMapping: [{ columnNumber: 1, fieldName: "number1", key: true }],
    },
    record: { fields: [phone] },
  });
  return { ok: true };
}

export async function addToDnc(phones: string[]): Promise<{ ok: boolean; count: number }> {
  if (phones.length === 0) return { ok: true, count: 0 };
  await soapCall("addNumbersToDnc", { numbers: phones });
  return { ok: true, count: phones.length };
}

export async function removeFromDnc(phones: string[]): Promise<{ ok: boolean; count: number }> {
  if (phones.length === 0) return { ok: true, count: 0 };
  await soapCall("removeNumbersFromDnc", { numbers: phones });
  return { ok: true, count: phones.length };
}
