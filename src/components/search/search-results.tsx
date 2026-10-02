"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SEARCH_TYPES,
  searchHref,
  type SearchResponse,
  type SearchSort,
  type SearchType,
} from "@/lib/search-types";
import styles from "./search-results.module.css";

export function SearchResults({
  query,
  type,
  page,
  sort,
}: {
  query: string;
  type?: SearchType;
  page: number;
  sort: SearchSort;
}) {
  const router = useRouter();
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    setData(null);
    setError("");
    if (query.length < 2) return;
    const params = new URLSearchParams({
      q: query,
      view: "all",
      page: String(page),
      sort,
    });
    if (type) params.set("type", type);
    fetch(`/api/search?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok)
          throw new Error(result.error || "Search could not be completed.");
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message || "Search could not be completed.");
      });
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [query, type, page, sort, retry]);
  const loading = query.length >= 2 && !data && !error;
  const groups =
    data?.groups.filter((g) => (type ? g.type === type : g.count > 0)) || [];
  const selected = data?.groups.find((g) => g.type === type);
  const empty = data && (type ? !selected?.count : !data.total);
  const number = (n: number) => n.toLocaleString("en-US");

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Search categories">
        <h1>Search Results</h1>
        <p className={styles.query} title={query}>
          {query ? `“${query}”` : "Search your CRM"}
        </p>
        <nav aria-label="Filter search results">
          <Link
            prefetch={false}
            href={searchHref(query, undefined, 1, sort)}
            className={!type ? styles.active : ""}
            aria-current={!type ? "page" : undefined}
          >
            <span>Top Results</span>
            {data && <span className={styles.count}>{number(data.total)}</span>}
          </Link>
          {data?.groups.map((group) => (
            <Link
              prefetch={false}
              key={group.type}
              href={searchHref(query, group.type, 1, sort)}
              className={type === group.type ? styles.active : ""}
              aria-current={type === group.type ? "page" : undefined}
            >
              <span>
                {SEARCH_TYPES.find((t) => t.key === group.type)!.label}
              </span>
              <span className={styles.count}>{number(group.count)}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className={styles.results} aria-busy={loading}>
        <div className={styles.toolbar}>
          <span role="status" aria-live="polite">
            {loading
              ? "Searching…"
              : data
                ? `${number(type ? selected?.count || 0 : data.total)} results for “${query}”`
                : "Search across your CRM records"}
          </span>
          <label>
            Sort by{" "}
            <select
              aria-label="Sort search results"
              value={sort}
              onChange={(e) =>
                router.push(
                  searchHref(query, type, 1, e.target.value as SearchSort),
                )
              }
            >
              <option value="name">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
        {query.length < 2 && (
          <div className={styles.empty}>
            <SearchIcon />
            <h2>What are you looking for?</h2>
            <p>
              Enter at least two characters in the search bar, then press Enter.
            </p>
          </div>
        )}
        {loading && (
          <div className={styles.skeleton} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <span />
                {[0, 1, 2, 3].map((j) => (
                  <p key={j} />
                ))}
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className={styles.empty} role="alert">
            <h2>Search couldn’t be completed</h2>
            <p>{error}</p>
            <button
              className="slds-button slds-button_neutral"
              onClick={() => setRetry((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        )}
        {empty && (
          <div className={styles.empty}>
            <SearchIcon />
            <h2>
              No results
              {type
                ? ` in ${SEARCH_TYPES.find((t) => t.key === type)!.label}`
                : ""}
            </h2>
            <p>Try a different name, company, email, or phone number.</p>
            {type && data.total > 0 && (
              <Link prefetch={false} href={searchHref(query)}>
                View matches in other categories
              </Link>
            )}
          </div>
        )}
        {groups
          .filter((group) => group.count > 0)
          .map((group) => {
            const meta = SEARCH_TYPES.find((t) => t.key === group.type)!;
            const totalPages = Math.ceil(group.count / group.pageSize);
            const start = (group.page - 1) * group.pageSize + 1;
            const end = Math.min(group.count, start + group.rows.length - 1);
            return (
              <section
                className={styles.card}
                aria-labelledby={`results-${group.type}`}
                key={group.type}
              >
                <header className={styles.cardHeader}>
                  <div>
                    <h2 id={`results-${group.type}`}>
                      <Link
                        prefetch={false}
                        href={searchHref(query, group.type, 1, sort)}
                      >
                        {meta.label}
                      </Link>
                    </h2>
                    <p>
                      {number(group.count)}{" "}
                      {group.count === 1 ? "result" : "results"}
                      {!type && group.count > group.rows.length
                        ? ` · Showing first ${group.rows.length}`
                        : type
                          ? ` · ${number(start)}–${number(end)}`
                          : ""}
                    </p>
                  </div>
                  {!type && (
                    <Link
                      prefetch={false}
                      href={searchHref(query, group.type, 1, sort)}
                      aria-label={`View all ${meta.label.toLowerCase()}`}
                    >
                      View All
                    </Link>
                  )}
                </header>
                <div
                  className={styles.tableScroll}
                  tabIndex={0}
                  role="region"
                  aria-label={`${meta.label} results`}
                >
                  <table>
                    <thead>
                      <tr>
                        {meta.columns.map((column, i) => (
                          <th scope="col" key={column}>
                            {i === 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    searchHref(
                                      query,
                                      type,
                                      1,
                                      sort === "name" ? "name-desc" : "name",
                                    ),
                                  )
                                }
                              >
                                {column}
                                <span aria-hidden="true">
                                  {sort === "name"
                                    ? "↑"
                                    : sort === "name-desc"
                                      ? "↓"
                                      : "↕"}
                                </span>
                              </button>
                            ) : (
                              column
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.id}>
                          {row.cells.map((cell, i) => (
                            <td key={i} title={cell.text}>
                              {cell.href ? (
                                <Link prefetch={false} href={cell.href}>
                                  {cell.text}
                                </Link>
                              ) : (
                                cell.text
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {type && totalPages > 1 && (
                  <footer
                    className={styles.pagination}
                    aria-label={`${meta.label} pagination`}
                  >
                    <span>
                      Page {number(group.page)} of {number(totalPages)}
                    </span>
                    <div>
                      {group.page > 1 ? (
                        <Link
                          prefetch={false}
                          className="slds-button slds-button_neutral"
                          href={searchHref(
                            query,
                            group.type,
                            group.page - 1,
                            sort,
                          )}
                        >
                          Previous
                        </Link>
                      ) : (
                        <button
                          className="slds-button slds-button_neutral"
                          disabled
                        >
                          Previous
                        </button>
                      )}
                      {group.page < totalPages ? (
                        <Link
                          prefetch={false}
                          className="slds-button slds-button_neutral"
                          href={searchHref(
                            query,
                            group.type,
                            group.page + 1,
                            sort,
                          )}
                        >
                          Next
                        </Link>
                      ) : (
                        <button
                          className="slds-button slds-button_neutral"
                          disabled
                        >
                          Next
                        </button>
                      )}
                    </div>
                  </footer>
                )}
              </section>
            );
          })}
        {data && data.total > 0 && !type && (
          <div className={styles.hint}>
            <SearchIcon />
            <div>
              <h2>Looking for more?</h2>
              <p>
                Select a category or View All to browse every matching record.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function SearchIcon() {
  return (
    <svg className={styles.searchIcon} aria-hidden="true">
      <use href="/slds/icons/utility-sprite/svg/symbols.svg#search" />
    </svg>
  );
}
