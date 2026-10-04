import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { SfListPage } from "@/components/slds/sf-list-page";
import { ListView } from "@/components/slds/list-view";
import { RecordLinkCell } from "@/components/lists/record-link-cell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/leads",
}));

describe("record links in editable lists", () => {
  it("keeps the record link separate from its edit button", () => {
    const html = renderToStaticMarkup(createElement(SfListPage, {
      entity: "lead", title: "Leads", subtitle: "All Leads", count: 1,
      iconSlug: "lead", actions: [], pathname: "/leads",
      massConfig: { entity: "lead" },
      columns: [{ key: "status", label: "Status" }],
      rows: [{ id: "lead", href: "/leads/lead", cells: [createElement(InlineEditCell, {
        entity: "lead", recordId: "lead", config: { field: "status", type: "enum" }, value: "New",
      })] }],
    }));
    const recordLink = html.match(/<a\b[^>]*href="\/leads\/lead"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    expect(recordLink).toBe("New");
    expect(html).toContain('aria-label="Edit status"');
    expect(html).not.toContain("Click to edit");
  });

  it("preserves record navigation when inline editing is disabled", () => {
    const html = renderToStaticMarkup(createElement(InlineEditCell, {
      entity: "lead", recordId: "lead", config: { field: "status", type: "enum" },
      value: "Test Lead", recordHref: "/leads/lead", editable: false,
    }));
    expect(html).toContain('href="/leads/lead"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
  });

  it("also keeps edit controls outside links in the events list", () => {
    const html = renderToStaticMarkup(createElement(ListView, {
      entity: "Event", totalCount: 1, rows: [{ id: "event" }],
      rowHref: row => `/events/${row.id}`,
      columns: [{ key: "status", label: "Status", render: row => createElement(InlineEditCell, {
        entity: "event", recordId: row.id, config: { field: "status", type: "enum" }, value: "SCHEDULED",
      }) }],
    }));
    expect(html.match(/<a\b[^>]*href="\/events\/event"[^>]*>([\s\S]*?)<\/a>/)?.[1]).toBe("SCHEDULED");
    expect(html).toContain('aria-label="Edit status"');
  });

  it.each(["contactName", "phone"])("does not offer %s edits that the save endpoint rejects", field => {
    const html = renderToStaticMarkup(createElement(InlineEditCell, {
      entity: "lead", recordId: "lead", config: { field, type: "text" }, value: "Test value",
    }));
    expect(html).toContain("Test value");
    expect(html).not.toContain("<button");
  });

  it("retains standard links for cells without inline editing", () => {
    const html = renderToStaticMarkup(createElement(RecordLinkCell, { href: "/cases/case" }, "Case 001"));
    expect(html).toContain('href="/cases/case"');
    expect(html).toContain(">Case 001</a>");
    expect(html).not.toContain("<button");
  });
});
