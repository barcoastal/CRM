"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, TestTube2 } from "lucide-react";

const STORAGE_KEY = "coastal-crm-settings";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailSettings {
  provider: "none" | "smtp" | "sendgrid" | "mailgun";
  smtp: {
    host: string;
    port: string;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
  };
  sendgrid: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
  mailgun: {
    apiKey: string;
    domain: string;
    fromEmail: string;
    fromName: string;
  };
}

interface TwilioSettings {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

interface GeneralSettings {
  companyName: string;
  timezone: string;
}

interface ProfileSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  smsAlerts: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
}

interface PasswordFields {
  current: string;
  next: string;
  confirm: string;
}

interface AllSettings {
  email: EmailSettings;
  twilio: TwilioSettings;
  general: GeneralSettings;
  profile: ProfileSettings;
  notifications: NotificationPreferences;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultSettings: AllSettings = {
  email: {
    provider: "none",
    smtp: { host: "", port: "587", username: "", password: "", fromEmail: "", fromName: "" },
    sendgrid: { apiKey: "", fromEmail: "", fromName: "" },
    mailgun: { apiKey: "", domain: "", fromEmail: "", fromName: "" },
  },
  twilio: {
    accountSid: "",
    authToken: "",
    phoneNumber: "",
  },
  general: {
    companyName: "",
    timezone: "America/New_York",
  },
  profile: {
    firstName: "Bar",
    lastName: "Elezra",
    email: "bar@coastaldebt.com",
    phone: "(555) 100-0001",
    role: "Super Admin",
  },
  notifications: {
    emailNotifications: true,
    smsAlerts: true,
    dailyDigest: false,
    weeklyReport: true,
  },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadSettings(): AllSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        email: { ...defaultSettings.email, ...parsed.email },
        twilio: { ...defaultSettings.twilio, ...parsed.twilio },
        general: { ...defaultSettings.general, ...parsed.general },
        profile: { ...defaultSettings.profile, ...parsed.profile },
        notifications: { ...defaultSettings.notifications, ...parsed.notifications },
      };
    }
  } catch {
    // ignore parse errors
  }
  return defaultSettings;
}

function saveSettings(settings: AllSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "Profile" | "Team" | "Integrations" | "Notifications" | "Billing";
const TABS: Tab[] = ["Profile", "Team", "Integrations", "Notifications", "Billing"];

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3052ff]/50 ${
        checked ? "bg-[#3052ff]" : "bg-[#c4c5d9]"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-[3px] ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ─── Field group ─────────────────────────────────────────────────────────────

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-medium text-[#444656] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ─── Input style ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-[#f2f3ff] text-[#131b2e] rounded-sm border-0 outline-none focus:ring-2 focus:ring-[#3052ff]/25 transition-shadow";
const readonlyCls =
  "w-full px-3.5 py-2.5 text-sm bg-[#eaedff] text-[#444656] rounded-sm border-0 outline-none cursor-default";

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsContent() {
  const [settings, setSettings] = useState<AllSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Profile");
  const [password, setPassword] = useState<PasswordFields>({ current: "", next: "", confirm: "" });

  useEffect(() => {
    setSettings(loadSettings());
    setMounted(true);
  }, []);

  // ── Updaters ────────────────────────────────────────────────────────────────

  const updateEmailSettings = (updates: Partial<EmailSettings>) => {
    setSettings((prev) => ({ ...prev, email: { ...prev.email, ...updates } }));
  };

  const updateSmtp = (field: keyof EmailSettings["smtp"], value: string) => {
    setSettings((prev) => ({
      ...prev,
      email: { ...prev.email, smtp: { ...prev.email.smtp, [field]: value } },
    }));
  };

  const updateSendgrid = (field: keyof EmailSettings["sendgrid"], value: string) => {
    setSettings((prev) => ({
      ...prev,
      email: { ...prev.email, sendgrid: { ...prev.email.sendgrid, [field]: value } },
    }));
  };

  const updateMailgun = (field: keyof EmailSettings["mailgun"], value: string) => {
    setSettings((prev) => ({
      ...prev,
      email: { ...prev.email, mailgun: { ...prev.email.mailgun, [field]: value } },
    }));
  };

  const updateTwilio = (field: keyof TwilioSettings, value: string) => {
    setSettings((prev) => ({ ...prev, twilio: { ...prev.twilio, [field]: value } }));
  };

  const updateGeneral = (field: keyof GeneralSettings, value: string) => {
    setSettings((prev) => ({ ...prev, general: { ...prev.general, [field]: value } }));
  };

  const updateProfile = (field: keyof ProfileSettings, value: string) => {
    setSettings((prev) => ({ ...prev, profile: { ...prev.profile, [field]: value } }));
  };

  const updateNotification = (field: keyof NotificationPreferences, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value },
    }));
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSaveEmail = () => { saveSettings(settings); toast.success("Email settings saved"); };
  const handleSaveTwilio = () => { saveSettings(settings); toast.success("Twilio settings saved"); };
  const handleSaveGeneral = () => { saveSettings(settings); toast.success("General settings saved"); };

  const handleTestEmail = () => {
    if (settings.email.provider === "none") {
      toast.error("Please select an email provider first");
      return;
    }
    toast.info("Email test connection is not yet implemented. Settings are saved locally.");
  };

  const handleTestTwilio = () => {
    if (!settings.twilio.accountSid || !settings.twilio.authToken) {
      toast.error("Please enter Account SID and Auth Token first");
      return;
    }
    toast.info("Twilio test connection is not yet implemented. Settings are saved locally.");
  };

  const handleSaveProfile = () => {
    if (password.next && password.next !== password.confirm) {
      toast.error("New password and confirm password do not match");
      return;
    }
    saveSettings(settings);
    setPassword({ current: "", next: "", confirm: "" });
    toast.success("Profile saved");
  };

  const isEmailConfigured = settings.email.provider !== "none";
  const isTwilioConfigured =
    settings.twilio.accountSid !== "" &&
    settings.twilio.authToken !== "" &&
    settings.twilio.phoneNumber !== "";

  const initials =
    `${settings.profile.firstName.charAt(0)}${settings.profile.lastName.charAt(0)}`.toUpperCase() || "BE";

  if (!mounted) return null;

  return (
    <div>
      {/* Page header */}
      <h1 className="font-bold text-2xl text-[#131b2e] mb-6 tracking-tight">Settings</h1>

      <div className="flex gap-6 items-start">
        {/* ── Left vertical tabs ── */}
        <nav className="w-48 flex-shrink-0 bg-[#f2f3ff] rounded-xl p-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-4 py-2.5 text-sm rounded font-medium transition-all duration-150 ${
                activeTab === tab
                  ? "bg-white text-[#3052ff] font-semibold shadow-[0_2px_8px_rgba(19,27,46,0.06)]"
                  : "text-[#444656] hover:text-[#131b2e] hover:bg-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* ── Right panel ── */}
        <div className="flex-1">

          {/* ════════════════ PROFILE TAB ════════════════ */}
          {activeTab === "Profile" && (
            <div className="bg-white rounded-xl p-8 shadow-coastal">
              <div className="grid grid-cols-2 gap-10">

                {/* Left: Profile info */}
                <div>
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-3xl mb-7 select-none">
                    {initials}
                  </div>

                  <FieldGroup label="First Name">
                    <input
                      className={inputCls}
                      type="text"
                      value={settings.profile.firstName}
                      onChange={(e) => updateProfile("firstName", e.target.value)}
                    />
                  </FieldGroup>

                  <FieldGroup label="Last Name">
                    <input
                      className={inputCls}
                      type="text"
                      value={settings.profile.lastName}
                      onChange={(e) => updateProfile("lastName", e.target.value)}
                    />
                  </FieldGroup>

                  <FieldGroup label="Email">
                    <input
                      className={inputCls}
                      type="email"
                      value={settings.profile.email}
                      onChange={(e) => updateProfile("email", e.target.value)}
                    />
                  </FieldGroup>

                  <FieldGroup label="Phone">
                    <input
                      className={inputCls}
                      type="tel"
                      value={settings.profile.phone}
                      onChange={(e) => updateProfile("phone", e.target.value)}
                    />
                  </FieldGroup>

                  <FieldGroup label="Role">
                    <input
                      className={readonlyCls}
                      type="text"
                      value={settings.profile.role}
                      readOnly
                      tabIndex={-1}
                    />
                  </FieldGroup>
                </div>

                {/* Right: Password + Notifications */}
                <div>
                  <p className="font-bold text-base text-[#131b2e] mb-5 font-sans">
                    Change Password
                  </p>

                  <FieldGroup label="Current Password">
                    <input
                      className={inputCls}
                      type="password"
                      placeholder="Enter current password"
                      value={password.current}
                      onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
                    />
                  </FieldGroup>

                  <FieldGroup label="New Password">
                    <input
                      className={inputCls}
                      type="password"
                      placeholder="Enter new password"
                      value={password.next}
                      onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
                    />
                  </FieldGroup>

                  <FieldGroup label="Confirm Password">
                    <input
                      className={inputCls}
                      type="password"
                      placeholder="Confirm new password"
                      value={password.confirm}
                      onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                    />
                  </FieldGroup>

                  {/* Divider */}
                  <div className="h-px bg-[#eaedff] my-6" />

                  <p className="font-bold text-base text-[#131b2e] mb-4 font-sans">
                    Notification Preferences
                  </p>

                  {(
                    [
                      { key: "emailNotifications", label: "Email notifications" },
                      { key: "smsAlerts", label: "SMS alerts" },
                      { key: "dailyDigest", label: "Daily digest" },
                      { key: "weeklyReport", label: "Weekly report" },
                    ] as { key: keyof NotificationPreferences; label: string }[]
                  ).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-[#131b2e]">{label}</span>
                      <Toggle
                        checked={settings.notifications[key]}
                        onChange={(v) => updateNotification(key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="px-8 py-2.5 text-sm font-semibold text-white gradient-primary rounded cursor-pointer transition-all duration-150 hover:opacity-90 hover:-translate-y-px border-0"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* ════════════════ TEAM TAB ════════════════ */}
          {activeTab === "Team" && (
            <div className="bg-white rounded-xl p-8 shadow-coastal">
              <p className="font-bold text-base text-[#131b2e] mb-2">Team Members</p>
              <p className="text-sm text-[#444656]">Team management is coming soon.</p>
            </div>
          )}

          {/* ════════════════ INTEGRATIONS TAB ════════════════ */}
          {activeTab === "Integrations" && (
            <div className="space-y-6">

              {/* Email Integration */}
              <div className="bg-white rounded-xl p-8 shadow-coastal">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="font-bold text-base text-[#131b2e]">Email Integration</p>
                    <p className="text-xs text-[#444656] mt-0.5">
                      Configure email service for sending proposals and notifications
                    </p>
                  </div>
                  <Badge variant={isEmailConfigured ? "default" : "secondary"}>
                    {isEmailConfigured ? "Connected" : "Not Configured"}
                  </Badge>
                </div>

                <div className="mb-5">
                  <Label htmlFor="emailProvider" className="text-xs font-medium text-[#444656] mb-1.5 block">
                    Provider
                  </Label>
                  <Select
                    value={settings.email.provider}
                    onValueChange={(v) =>
                      updateEmailSettings({ provider: v as EmailSettings["provider"] })
                    }
                  >
                    <SelectTrigger id="emailProvider" className="bg-[#f2f3ff] border-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Disabled)</SelectItem>
                      <SelectItem value="smtp">SMTP</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* SMTP Fields */}
                {settings.email.provider === "smtp" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { id: "smtpHost", label: "Host", field: "host" as const, placeholder: "smtp.example.com", type: "text" },
                      { id: "smtpPort", label: "Port", field: "port" as const, placeholder: "587", type: "text" },
                      { id: "smtpUsername", label: "Username", field: "username" as const, placeholder: "username", type: "text" },
                      { id: "smtpPassword", label: "Password", field: "password" as const, placeholder: "••••••••", type: "password" },
                      { id: "smtpFromEmail", label: "From Email", field: "fromEmail" as const, placeholder: "noreply@example.com", type: "email" },
                      { id: "smtpFromName", label: "From Name", field: "fromName" as const, placeholder: "Coastal CRM", type: "text" },
                    ].map(({ id, label, field, placeholder, type }) => (
                      <div key={id} className="space-y-1.5">
                        <Label htmlFor={id} className="text-xs font-medium text-[#444656]">{label}</Label>
                        <Input
                          id={id}
                          type={type}
                          placeholder={placeholder}
                          value={settings.email.smtp[field]}
                          onChange={(e) => updateSmtp(field, e.target.value)}
                          className="bg-[#f2f3ff] border-0"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* SendGrid Fields */}
                {settings.email.provider === "sendgrid" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="sendgridApiKey" className="text-xs font-medium text-[#444656]">API Key</Label>
                      <Input
                        id="sendgridApiKey"
                        type="password"
                        placeholder="SG.xxxxxxxxxxxx"
                        value={settings.email.sendgrid.apiKey}
                        onChange={(e) => updateSendgrid("apiKey", e.target.value)}
                        className="bg-[#f2f3ff] border-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sendgridFromEmail" className="text-xs font-medium text-[#444656]">From Email</Label>
                      <Input
                        id="sendgridFromEmail"
                        type="email"
                        placeholder="noreply@example.com"
                        value={settings.email.sendgrid.fromEmail}
                        onChange={(e) => updateSendgrid("fromEmail", e.target.value)}
                        className="bg-[#f2f3ff] border-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sendgridFromName" className="text-xs font-medium text-[#444656]">From Name</Label>
                      <Input
                        id="sendgridFromName"
                        placeholder="Coastal CRM"
                        value={settings.email.sendgrid.fromName}
                        onChange={(e) => updateSendgrid("fromName", e.target.value)}
                        className="bg-[#f2f3ff] border-0"
                      />
                    </div>
                  </div>
                )}

                {/* Mailgun Fields */}
                {settings.email.provider === "mailgun" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="mailgunApiKey" className="text-xs font-medium text-[#444656]">API Key</Label>
                      <Input
                        id="mailgunApiKey"
                        type="password"
                        placeholder="key-xxxxxxxxxxxx"
                        value={settings.email.mailgun.apiKey}
                        onChange={(e) => updateMailgun("apiKey", e.target.value)}
                        className="bg-[#f2f3ff] border-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mailgunDomain" className="text-xs font-medium text-[#444656]">Domain</Label>
                      <Input
                        id="mailgunDomain"
                        placeholder="mg.example.com"
                        value={settings.email.mailgun.domain}
                        onChange={(e) => updateMailgun("domain", e.target.value)}
                        className="bg-[#f2f3ff] border-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mailgunFromEmail" className="text-xs font-medium text-[#444656]">From Email</Label>
                      <Input
                        id="mailgunFromEmail"
                        type="email"
                        placeholder="noreply@example.com"
                        value={settings.email.mailgun.fromEmail}
                        onChange={(e) => updateMailgun("fromEmail", e.target.value)}
                        className="bg-[#f2f3ff] border-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mailgunFromName" className="text-xs font-medium text-[#444656]">From Name</Label>
                      <Input
                        id="mailgunFromName"
                        placeholder="Coastal CRM"
                        value={settings.email.mailgun.fromName}
                        onChange={(e) => updateMailgun("fromName", e.target.value)}
                        className="bg-[#f2f3ff] border-0"
                      />
                    </div>
                  </div>
                )}

                {settings.email.provider !== "none" && (
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-[#eaedff]">
                    <Button variant="outline" onClick={handleTestEmail} className="border-[#eaedff]">
                      <TestTube2 className="size-4 mr-2" />
                      Test Connection
                    </Button>
                    <button
                      type="button"
                      onClick={handleSaveEmail}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white gradient-primary rounded cursor-pointer transition-all duration-150 hover:opacity-90 border-0"
                    >
                      <Save className="size-4" />
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Twilio Integration */}
              <div className="bg-white rounded-xl p-8 shadow-coastal">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="font-bold text-base text-[#131b2e]">Twilio — Phone Integration</p>
                    <p className="text-xs text-[#444656] mt-0.5">
                      Connect Twilio to enable real phone calls from the dialer
                    </p>
                  </div>
                  <Badge variant={isTwilioConfigured ? "default" : "secondary"}>
                    {isTwilioConfigured ? "Connected" : "Not Configured"}
                  </Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="twilioSid" className="text-xs font-medium text-[#444656]">Account SID</Label>
                    <Input
                      id="twilioSid"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.twilio.accountSid}
                      onChange={(e) => updateTwilio("accountSid", e.target.value)}
                      className="bg-[#f2f3ff] border-0"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="twilioToken" className="text-xs font-medium text-[#444656]">Auth Token</Label>
                    <Input
                      id="twilioToken"
                      type="password"
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.twilio.authToken}
                      onChange={(e) => updateTwilio("authToken", e.target.value)}
                      className="bg-[#f2f3ff] border-0"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="twilioPhone" className="text-xs font-medium text-[#444656]">Phone Number (From Number)</Label>
                    <Input
                      id="twilioPhone"
                      placeholder="+15551234567"
                      value={settings.twilio.phoneNumber}
                      onChange={(e) => updateTwilio("phoneNumber", e.target.value)}
                      className="bg-[#f2f3ff] border-0"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-[#eaedff]">
                  <Button variant="outline" onClick={handleTestTwilio} className="border-[#eaedff]">
                    <TestTube2 className="size-4 mr-2" />
                    Test Connection
                  </Button>
                  <button
                    type="button"
                    onClick={handleSaveTwilio}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white gradient-primary rounded cursor-pointer transition-all duration-150 hover:opacity-90 border-0"
                  >
                    <Save className="size-4" />
                    Save
                  </button>
                </div>
              </div>

              {/* General Settings */}
              <div className="bg-white rounded-xl p-8 shadow-coastal">
                <p className="font-bold text-base text-[#131b2e] mb-6">General Settings</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName" className="text-xs font-medium text-[#444656]">Company Name</Label>
                    <Input
                      id="companyName"
                      placeholder="Your Company Name"
                      value={settings.general.companyName}
                      onChange={(e) => updateGeneral("companyName", e.target.value)}
                      className="bg-[#f2f3ff] border-0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="timezone" className="text-xs font-medium text-[#444656]">Default Timezone</Label>
                    <Select
                      value={settings.general.timezone}
                      onValueChange={(v) => updateGeneral("timezone", v)}
                    >
                      <SelectTrigger id="timezone" className="bg-[#f2f3ff] border-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern (America/New_York)</SelectItem>
                        <SelectItem value="America/Chicago">Central (America/Chicago)</SelectItem>
                        <SelectItem value="America/Denver">Mountain (America/Denver)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific (America/Los_Angeles)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[#eaedff]">
                  <button
                    type="button"
                    onClick={handleSaveGeneral}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white gradient-primary rounded cursor-pointer transition-all duration-150 hover:opacity-90 border-0"
                  >
                    <Save className="size-4" />
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ NOTIFICATIONS TAB ════════════════ */}
          {activeTab === "Notifications" && (
            <div className="bg-white rounded-xl p-8 shadow-coastal">
              <p className="font-bold text-base text-[#131b2e] mb-6">Notification Preferences</p>

              {(
                [
                  { key: "emailNotifications", label: "Email notifications", description: "Receive updates and alerts via email" },
                  { key: "smsAlerts", label: "SMS alerts", description: "Get time-sensitive notifications by text message" },
                  { key: "dailyDigest", label: "Daily digest", description: "A summary of activity delivered each morning" },
                  { key: "weeklyReport", label: "Weekly report", description: "Performance report delivered every Monday" },
                ] as { key: keyof NotificationPreferences; label: string; description: string }[]
              ).map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between py-4 border-b border-[#eaedff] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#131b2e]">{label}</p>
                    <p className="text-xs text-[#444656] mt-0.5">{description}</p>
                  </div>
                  <Toggle
                    checked={settings.notifications[key]}
                    onChange={(v) => updateNotification(key, v)}
                  />
                </div>
              ))}

              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => { saveSettings(settings); toast.success("Notification preferences saved"); }}
                  className="px-8 py-2.5 text-sm font-semibold text-white gradient-primary rounded cursor-pointer transition-all duration-150 hover:opacity-90 hover:-translate-y-px border-0"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* ════════════════ BILLING TAB ════════════════ */}
          {activeTab === "Billing" && (
            <div className="bg-white rounded-xl p-8 shadow-coastal">
              <p className="font-bold text-base text-[#131b2e] mb-2">Billing</p>
              <p className="text-sm text-[#444656]">Billing management is coming soon.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
