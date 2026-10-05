import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";
import { chatAccount } from "@/lib/google-chat/access";
import { ChatError, googleChat, workspaceDomain } from "@/lib/google-chat/client";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
function failure(error: unknown) { return error instanceof ChatError ? respond({ error: error.message }, error.status) : respond({ error: "Unable to load Google Chat. Please try again." }, 500); }
const querySchema = z.object({ resource: z.enum(["spaces", "messages", "members", "people"]).default("spaces"), space: z.string().max(200).optional(), pageToken: z.string().max(4096).optional() }).strict();

export async function GET(req: NextRequest) {
  try {
    const account = await chatAccount();
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return respond({ error: "Invalid Chat request." }, 400);
    const q = parsed.data;
    if (q.resource === "people") {
      const people = await prisma.user.findMany({ where: { isActive: true, id: { not: account.id }, email: { endsWith: `@${workspaceDomain()}`, mode: "insensitive" } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
      return respond({ account, people });
    }
    const client = googleChat(account.email);
    if (q.resource === "spaces") {
      const result = await client.spaces(q.pageToken);
      const spaces = result.spaces ?? [];
      for (let i = 0; i < spaces.length; i += 5) {
        await Promise.all(spaces.slice(i, i + 5).map(async space => {
          if (space.displayName) return;
          try {
            const members = await client.members(space.name);
            const names = (members.memberships ?? []).filter(m => m.state !== "INVITED" && m.member?.email?.toLowerCase() !== account.email).map(m => m.member?.displayName || m.member?.email).filter(Boolean);
            space.displayName = names.join(", ") || (space.spaceType === "DIRECT_MESSAGE" ? "Direct message" : "Group conversation");
          } catch { space.displayName = space.spaceType === "DIRECT_MESSAGE" ? "Direct message" : "Group conversation"; }
        }));
      }
      return respond({ ...result, spaces });
    }
    if (!q.space) return respond({ error: "Choose a conversation." }, 400);
    return respond(q.resource === "members" ? await client.members(q.space, q.pageToken) : await client.messages(q.space, q.pageToken));
  } catch (error) { return failure(error); }
}
const writeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), space: z.string().max(200), text: z.string().trim().min(1).max(4000), requestId: z.string().uuid(), thread: z.string().max(250).optional() }).strict(),
  z.object({ action: z.literal("start"), userIds: z.array(z.string().min(1).max(128)).min(1).max(49), requestId: z.string().uuid() }).strict(),
]);
export async function POST(req: NextRequest) {
  try {
    const account = await chatAccount();
    const origin = req.headers.get("origin");
    const sameOrigin = req.headers.get("sec-fetch-site") === "same-origin" || origin === new URL(req.url).origin || origin === "https://crm.coastaldebt-tools.com";
    if (!origin || !sameOrigin || !req.headers.get("content-type")?.startsWith("application/json")) return respond({ error: "Invalid request origin." }, 403);
    const parsed = writeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return respond({ error: "Check the message or recipients and try again." }, 400);
    const d = parsed.data, client = googleChat(account.email);
    if (d.action === "send") {
      const message = await client.send(d.space, d.text, d.requestId, d.thread);
      await auditWrite({ userId: account.id, entity: "GoogleChat", entityId: message.name, action: "CREATE", after: { operation: "send", space: d.space } }).catch(() => undefined);
      return respond({ message });
    }
    const ids = [...new Set(d.userIds)];
    if (ids.includes(account.id)) return respond({ error: "Choose another coworker." }, 400);
    const people = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true, email: { endsWith: `@${workspaceDomain()}`, mode: "insensitive" } }, select: { email: true } });
    if (people.length !== ids.length) return respond({ error: "One or more selected coworkers are unavailable." }, 400);
    const space = await client.start(people.map(p => p.email.toLowerCase()), d.requestId);
    await auditWrite({ userId: account.id, entity: "GoogleChat", entityId: space.name, action: "CREATE", after: { operation: "start" } }).catch(() => undefined);
    return respond({ space });
  } catch (error) { return failure(error); }
}
