import { requireAuthOrRespond } from "@/lib/api-auth";
import { globalSearch } from "@/lib/global-search";
import {
  normalizeSearchQuery,
  searchPage,
  searchSort,
  searchType,
} from "@/lib/search-types";
import { ssnSafeJson } from "@/lib/ssn-safe-json";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const authed = await requireAuthOrRespond();
  if ("response" in authed) return authed.response;
  const params = new URL(req.url).searchParams;
  const q = normalizeSearchQuery(params.get("q") || "");
  const full = params.get("view") === "all";
  if (q.length > 200)
    return ssnSafeJson(
      { error: "Use 200 characters or fewer." },
      { status: 400 },
    );
  if (q.length < 2)
    return ssnSafeJson(
      full ? { query: q, total: 0, groups: [] } : { results: [] },
    );
  try {
    const data = await globalSearch(authed.session, {
      query: q,
      full,
      type: searchType(params.get("type")),
      page: searchPage(params.get("page")),
      sort: searchSort(params.get("sort")),
    });
    return ssnSafeJson(
      full ? data : { results: data.groups.flatMap((g) => g.rows) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      "[global-search]",
      error instanceof Error ? error.message : "Search failed",
    );
    return ssnSafeJson(
      { error: "Search could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
