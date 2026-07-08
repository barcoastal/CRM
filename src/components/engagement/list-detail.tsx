"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "@/components/icons/lucide";

type Member = {
  id: string;
  source: string;
  addedAt: string;
  lead: {
    id: string;
    businessName: string;
    contactName: string;
    email: string | null;
    phone: string;
    status: string;
  } | null;
};

export function LeadListDetail(props: {
  list: { id: string; name: string; description: string | null; isActive: boolean };
  memberCount: number;
  members: Member[];
}) {
  const router = useRouter();
  const [name, setName] = useState(props.list.name);
  const [description, setDescription] = useState(props.list.description ?? "");
  const [isActive, setIsActive] = useState(props.list.isActive);
  const [addLeadId, setAddLeadId] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== props.list.name ||
    description !== (props.list.description ?? "") ||
    isActive !== props.list.isActive;

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/engagement/lists/${props.list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null, isActive }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to save");
      return;
    }
    toast.success("List saved");
    router.refresh();
  }

  async function addMember() {
    if (!addLeadId.trim()) return;
    const res = await fetch(`/api/engagement/lists/${props.list.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: addLeadId.trim() }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to add");
      return;
    }
    toast.success("Lead added");
    setAddLeadId("");
    router.refresh();
  }

  async function removeMember(leadId: string) {
    if (!confirm("Remove this lead from the list?")) return;
    const res = await fetch(`/api/engagement/lists/${props.list.id}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    if (!res.ok) {
      toast.error("Failed to remove");
      return;
    }
    toast.success("Removed");
    router.refresh();
  }

  async function deleteList() {
    if (!confirm("Delete this list? This cannot be undone.")) return;
    const res = await fetch(`/api/engagement/lists/${props.list.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("List deleted");
    router.push("/marketing/engagement/lists");
  }

  return (
    <div className="space-y-5">
      {/* Settings */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="text-[14px] font-bold text-[#131b2e] mb-3">List Settings</div>
        <div className="space-y-3 max-w-2xl">
          <div>
            <label className="block text-[12px] font-semibold text-[#444656] mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#444656] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4"
            />
            <label htmlFor="active" className="text-[13px] text-[#131b2e]">
              Active
            </label>
          </div>
          {dirty && (
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded text-[13px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setName(props.list.name);
                  setDescription(props.list.description ?? "");
                  setIsActive(props.list.isActive);
                }}
                className="px-4 py-1.5 rounded text-[13px] font-semibold text-[#444656] bg-[#f2f3ff]"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add member */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[14px] font-bold text-[#131b2e] flex-1">
            Members <span className="text-[#747474] font-normal">({props.memberCount} total)</span>
          </div>
          <input
            value={addLeadId}
            onChange={(e) => setAddLeadId(e.target.value)}
            placeholder="Lead ID"
            className="px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px] w-56"
          />
          <button
            onClick={addMember}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Plus className="size-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        {props.members.length === 0 ? (
          <div className="text-[13px] text-[#747474] py-10 text-center">No members yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafaff]">
              <tr>
                {["Business", "Contact", "Email", "Phone", "Status", "Source", "Added", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.4px] font-semibold text-[#444656] border-b border-[#f2f3ff]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.members.map((m) => (
                <tr key={m.id} className="border-b border-[#f2f3ff] last:border-b-0">
                  <td className="px-3 py-2 font-semibold text-[#131b2e]">
                    {m.lead?.businessName ?? "(deleted lead)"}
                  </td>
                  <td className="px-3 py-2 text-[#444656]">{m.lead?.contactName}</td>
                  <td className="px-3 py-2 text-[#444656]">{m.lead?.email ?? "-"}</td>
                  <td className="px-3 py-2 text-[#444656]">{m.lead?.phone}</td>
                  <td className="px-3 py-2 text-[#444656]">{m.lead?.status}</td>
                  <td className="px-3 py-2 text-[#747474]">{m.source}</td>
                  <td className="px-3 py-2 text-[#747474]">{new Date(m.addedAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    {m.lead && (
                      <button
                        onClick={() => removeMember(m.lead!.id)}
                        className="p-1.5 rounded text-[#942b00] hover:bg-[#fff2ed]"
                        title="Remove from list"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={deleteList}
          className="px-4 py-2 rounded text-[13px] font-semibold text-[#942b00] bg-[#fff2ed]"
        >
          Delete List
        </button>
      </div>
    </div>
  );
}
