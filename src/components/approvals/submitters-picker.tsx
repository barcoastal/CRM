"use client";

import { useState } from "react";
import { Plus, X } from "@/components/icons/lucide";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function SubmittersPicker({
  users,
  value,
  onChange,
}: {
  users: UserOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(value);
  const selectedUsers = users.filter((u) => selectedSet.has(u.id));

  const q = query.trim().toLowerCase();
  const matches = q
    ? users.filter(
        (u) =>
          !selectedSet.has(u.id) &&
          (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
      ).slice(0, 8)
    : [];

  function add(id: string) {
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
  }
  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedUsers.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-semibold bg-[#f2f3ff] text-[#3052ff]"
          >
            {u.name}
            <button
              type="button"
              onClick={() => remove(u.id)}
              className="ml-1 text-[#3052ff] hover:opacity-70"
              title="Remove"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {selectedUsers.length === 0 && (
          <span className="text-[12px] text-[#706e6b] italic">Anyone can submit.</span>
        )}
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Add user by name or email..."
          className="w-full px-3 py-1.5 border border-[#d8dde6] rounded text-[13px] outline-none focus:border-[#3052ff]"
        />
        {open && matches.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#d8dde6] rounded shadow-lg z-10 max-h-60 overflow-y-auto"
          >
            {matches.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => add(u.id)}
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#f2f3ff] flex items-center gap-2"
              >
                <Plus className="size-3 text-[#3052ff]" />
                <span className="font-semibold text-[#131b2e]">{u.name}</span>
                <span className="text-[12px] text-[#706e6b]">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
