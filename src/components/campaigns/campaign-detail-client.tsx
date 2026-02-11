"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddLeadsDialog } from "@/components/campaigns/add-leads-dialog";
import { DIALER_MODES } from "@/lib/validations/campaign";
import {
  ArrowLeft,
  Phone,
  Pause,
  Play,
  Plus,
  UserMinus,
  Users,
  PhoneCall,
  CheckCircle,
  Clock,
  Target,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PAUSED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  IN_PROGRESS:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  COMPLETED:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  SKIPPED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  MAX_ATTEMPTS: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
  status: string;
}

interface CampaignContact {
  id: string;
  leadId: string;
  lead: Lead;
  status: string;
  priority: number;
  attempts: number;
  lastAttempt: string | null;
}

interface Agent {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
  };
}

interface CampaignStats {
  totalContacts: number;
  dialed: number;
  connected: number;
  enrolled: number;
  remaining: number;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  dialerMode: string;
  status: string;
  script: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  contacts: CampaignContact[];
  agents: Agent[];
  stats: CampaignStats;
}

export function CampaignDetailClient({
  campaign: initialCampaign,
}: {
  campaign: Campaign;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function refreshCampaign() {
    const res = await fetch(`/api/campaigns/${campaign.id}`);
    if (res.ok) {
      const data = await res.json();
      setCampaign(data);
    }
    router.refresh();
  }

  async function toggleStatus() {
    setTogglingStatus(true);
    const newStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await refreshCampaign();
      }
    } finally {
      setTogglingStatus(false);
    }
  }

  async function removeAgent(userId: string) {
    const res = await fetch(`/api/campaigns/${campaign.id}/agents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] }),
    });
    if (res.ok) {
      await refreshCampaign();
    }
  }

  async function handleSettingsSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      dialerMode: formData.get("dialerMode") as string,
      script: (formData.get("script") as string) || undefined,
      startTime: (formData.get("startTime") as string) || undefined,
      endTime: (formData.get("endTime") as string) || undefined,
      timezone: formData.get("timezone") as string,
    };

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshCampaign();
      }
    } finally {
      setSaving(false);
    }
  }

  const existingLeadIds = campaign.contacts.map((c) => c.leadId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/campaigns">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">
                {campaign.name}
              </h2>
              <Badge
                className={STATUS_COLORS[campaign.status] || ""}
                variant="secondary"
              >
                {campaign.status}
              </Badge>
              <Badge variant="outline">{campaign.dialerMode}</Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground mt-1">
                {campaign.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status !== "COMPLETED" && (
            <Button
              variant="outline"
              onClick={toggleStatus}
              disabled={togglingStatus}
            >
              {campaign.status === "ACTIVE" ? (
                <>
                  <Pause className="size-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Resume
                </>
              )}
            </Button>
          )}
          <Button asChild>
            <Link href={`/dialer?campaignId=${campaign.id}`}>
              <Phone className="size-4" />
              Launch Dialer
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="size-4" />
              Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaign.stats.totalContacts}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PhoneCall className="size-4" />
              Dialed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.stats.dialed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="size-4" />
              Connected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaign.stats.connected}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="size-4" />
              Enrolled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.stats.enrolled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="size-4" />
              Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaign.stats.remaining}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="script">Script</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Campaign Contacts</h3>
            <Button onClick={() => setAddLeadsOpen(true)}>
              <Plus className="size-4" />
              Add Leads
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Lead Status</TableHead>
                  <TableHead>Campaign Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.contacts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No contacts in this campaign. Click &quot;Add Leads&quot;
                      to add some.
                    </TableCell>
                  </TableRow>
                ) : (
                  campaign.contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.lead.businessName}
                      </TableCell>
                      <TableCell>{contact.lead.contactName}</TableCell>
                      <TableCell>{contact.lead.phone}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{contact.lead.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            CONTACT_STATUS_COLORS[contact.status] || ""
                          }
                          variant="secondary"
                        >
                          {contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {contact.attempts}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Assigned Agents</h3>
            <AddAgentButton campaignId={campaign.id} onAdded={refreshCampaign} />
          </div>

          {campaign.agents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No agents assigned to this campaign yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {campaign.agents.map((agent) => (
                <Card key={agent.id}>
                  <CardContent className="flex items-center justify-between pt-6">
                    <div>
                      <div className="font-medium">{agent.user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {agent.user.email}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {agent.user.role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAgent(agent.userId)}
                      title="Remove agent"
                    >
                      <UserMinus className="size-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Script Tab */}
        <TabsContent value="script">
          <Card>
            <CardHeader>
              <CardTitle>Call Script</CardTitle>
            </CardHeader>
            <CardContent>
              {campaign.script ? (
                <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-relaxed">
                  {campaign.script}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No script has been added for this campaign. Go to the Settings
                  tab to add one.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSettingsSave} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="settings-name">Campaign Name</Label>
                  <Input
                    id="settings-name"
                    name="name"
                    defaultValue={campaign.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-description">Description</Label>
                  <Textarea
                    id="settings-description"
                    name="description"
                    defaultValue={campaign.description || ""}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-dialerMode">Dialer Mode</Label>
                  <Select
                    name="dialerMode"
                    defaultValue={campaign.dialerMode}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIALER_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-script">Call Script</Label>
                  <Textarea
                    id="settings-script"
                    name="script"
                    defaultValue={campaign.script || ""}
                    rows={6}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="settings-startTime">Start Time</Label>
                    <Input
                      id="settings-startTime"
                      name="startTime"
                      type="time"
                      defaultValue={campaign.startTime || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-endTime">End Time</Label>
                    <Input
                      id="settings-endTime"
                      name="endTime"
                      type="time"
                      defaultValue={campaign.endTime || ""}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-timezone">Timezone</Label>
                  <Select
                    name="timezone"
                    defaultValue={campaign.timezone}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Leads Dialog */}
      <AddLeadsDialog
        campaignId={campaign.id}
        existingLeadIds={existingLeadIds}
        open={addLeadsOpen}
        onOpenChange={setAddLeadsOpen}
        onLeadsAdded={refreshCampaign}
      />
    </div>
  );
}

// Inline AddAgent button component
function AddAgentButton({
  campaignId,
  onAdded,
}: {
  campaignId: string;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [users, setUsers] = useState<
    { id: string; name: string; email: string; role: string }[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);

  async function loadUsers() {
    setShowDropdown(true);
    try {
      const res = await fetch("/api/users?role=SALES_REP&limit=50");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data || []);
      }
    } catch {
      // Silently handle error
    }
  }

  async function addAgent(userId: string) {
    setAdding(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      });
      if (res.ok) {
        onAdded();
        setShowDropdown(false);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="relative">
      <Button onClick={loadUsers} disabled={adding}>
        <Plus className="size-4" />
        Add Agent
      </Button>
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border bg-popover p-2 shadow-md">
            {users.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No available users found
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addAgent(user.id)}
                    disabled={adding}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {user.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
