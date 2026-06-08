"use client";

import { useListSelection } from "./list-table-wrapper";

export function ListSelectAllCheckbox() {
  const { ids, selected, toggleAll } = useListSelection();
  const all = ids.length > 0 && selected.size === ids.length;
  const some = selected.size > 0 && !all;
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={toggleAll}
    />
  );
}

export function ListRowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useListSelection();
  return (
    <input
      type="checkbox"
      aria-label="Select row"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
