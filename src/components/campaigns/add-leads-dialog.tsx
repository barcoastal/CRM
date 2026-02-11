"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  status: string;
}

interface AddLeadsDialogProps {
  campaignId: string;
  existingLeadIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadsAdded: () => void;
}

export function AddLeadsDialog({
  campaignId,
  existingLeadIds,
  open,
  onOpenChange,
  onLeadsAdded,
}: AddLeadsDialogProps) {
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const searchLeads = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setLeads([]);
        return;
      }

      setSearching(true);
      try {
        const res = await fetch(
          `/api/leads?search=${encodeURIComponent(query)}&limit=20`
        );
        if (res.ok) {
          const data = await res.json();
          const leadsList = data.leads || data;
          // Filter out leads that are already in the campaign
          const existingSet = new Set(existingLeadIds);
          const filtered = (Array.isArray(leadsList) ? leadsList : []).filter(
            (lead: Lead) => !existingSet.has(lead.id)
          );
          setLeads(filtered);
        }
      } catch {
        // Silently handle error
      } finally {
        setSearching(false);
      }
    },
    [existingLeadIds]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      searchLeads(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchLeads]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setLeads([]);
      setSelectedIds(new Set());
    }
  }, [open]);

  function toggleLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });

      if (res.ok) {
        onLeadsAdded();
        onOpenChange(false);
      }
    } catch {
      // Silently handle error
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Leads to Campaign</DialogTitle>
          <DialogDescription>
            Search for leads by business name and add them to this campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by business name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border">
            {searching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {search.length < 2
                  ? "Type at least 2 characters to search"
                  : "No matching leads found"}
              </div>
            ) : (
              <div className="divide-y">
                {leads.map((lead) => (
                  <label
                    key={lead.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                      className="size-4 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {lead.businessName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {lead.contactName} - {lead.phone}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {lead.status}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || adding}
          >
            {adding
              ? "Adding..."
              : `Add Selected (${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
