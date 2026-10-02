import { SearchResults } from "@/components/search/search-results";
import {
  normalizeSearchQuery,
  searchPage,
  searchSort,
  searchType,
} from "@/lib/search-types";

export const metadata = { title: "Search Results | Coastal CRM" };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <SearchResults
      query={normalizeSearchQuery(params.q || "")}
      type={searchType(params.type)}
      page={searchPage(params.page)}
      sort={searchSort(params.sort)}
    />
  );
}
