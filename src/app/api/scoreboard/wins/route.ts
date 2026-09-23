import { requireAuthOrRespond } from "@/lib/api-auth";
import { scoreboardWins } from "@/lib/scoreboard";
import type { WinCursor } from "@/lib/scoreboard-shared";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await requireAuthOrRespond();
  if ("response" in auth) return auth.response;
  const params = new URL(request.url).searchParams;
  const at = params.get("since");
  const id = params.get("after") ?? "";
  if ((at && (!Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now() + 60_000)) || id.length > 100) {
    return Response.json({ error: "Invalid event cursor." }, { status: 400 });
  }
  const cursor: WinCursor | null = at ? { at, id } : null;
  try {
    return Response.json(await scoreboardWins(cursor), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[scoreboard] Win feed failed", error);
    return Response.json({ error: "Live celebrations are reconnecting." }, { status: 503 });
  }
}
