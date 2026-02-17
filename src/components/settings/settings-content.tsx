"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Phone, Settings, Save, TestTube2, Building } from "lucide-react";

const STORAGE_KEY = "coastal-crm-settings";

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

interface AllSettings {
  email: EmailSettings;
  twilio: TwilioSettings;
  general: GeneralSettings;
}

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
};

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

export function SettingsContent() {
  const [settings, setSettings] = useState<AllSettings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setMounted(true);
  }, []);

  const updateEmailSettings = (updates: Partial<EmailSettings>) => {
    setSettings((prev) => ({
      ...prev,
      email: { ...prev.email, ...updates },
    }));
  };

  const updateSmtp = (field: keyof EmailSettings["smtp"], value: string) => {
    setSettings((prev) => ({
      ...prev,
      email: {
        ...prev.email,
        smtp: { ...prev.email.smtp, [field]: value },
      },
    }));
  };

  const updateSendgrid = (field: keyof EmailSettings["sendgrid"], value: string) => {
    setSettings((prev) => ({
      ...prev,
      email: {
        ...prev.email,
        sendgrid: { ...prev.email.sendgrid, [field]: value },
      },
    }));
  };

  const updateMailgun = (field: keyof EmailSettings["mailgun"], value: string) => {
    setSettings((prev) => ({
      ...prev,
      email: {
        ...prev.email,
        mailgun: { ...prev.email.mailgun, [field]: value },
      },
    }));
  };

  const updateTwilio = (field: keyof TwilioSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      twilio: { ...prev.twilio, [field]: value },
    }));
  };

  const updateGeneral = (field: keyof GeneralSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, [field]: value },
    }));
  };

  const handleSaveEmail = () => {
    saveSettings(settings);
    toast.success("Email settings saved");
  };

  const handleSaveTwilio = () => {
    saveSettings(settings);
    toast.success("Twilio settings saved");
  };

  const handleSaveGeneral = () => {
    saveSettings(settings);
    toast.success("General settings saved");
  };

  const handleTestEmail = () => {
    if (settings.email.provider === "none") {
      toast.error("Please select an email provider first");
      return;
    }
    // For now, just show a placeholder message
    toast.info("Email test connection is not yet implemented. Settings are saved locally.");
  };

  const handleTestTwilio = () => {
    if (!settings.twilio.accountSid || !settings.twilio.authToken) {
      toast.error("Please enter Account SID and Auth Token first");
      return;
    }
    // For now, just show a placeholder message
    toast.info("Twilio test connection is not yet implemented. Settings are saved locally.");
  };

  const isEmailConfigured = settings.email.provider !== "none";
  const isTwilioConfigured =
    settings.twilio.accountSid !== "" &&
    settings.twilio.authToken !== "" &&
    settings.twilio.phoneNumber !== "";

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="size-6" />
          Settings
        </h2>
        <p className="text-muted-foreground">
          Manage your integrations and application preferences
        </p>
      </div>

      {/* Email Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Mail className="size-5" />
                Email Integration
              </CardTitle>
              <CardDescription>
                Configure email service for sending proposals and notifications
              </CardDescription>
            </div>
            <Badge variant={isEmailConfigured ? "default" : "secondary"}>
              {isEmailConfigured ? "Connected" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emailProvider">Provider</Label>
            <Select
              value={settings.email.provider}
              onValueChange={(v) =>
                updateEmailSettings({ provider: v as EmailSettings["provider"] })
              }
            >
              <SelectTrigger id="emailProvider">
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
              <div className="space-y-1.5">
                <Label htmlFor="smtpHost">Host</Label>
                <Input
                  id="smtpHost"
                  placeholder="smtp.example.com"
                  value={settings.email.smtp.host}
                  onChange={(e) => updateSmtp("host", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpPort">Port</Label>
                <Input
                  id="smtpPort"
                  placeholder="587"
                  value={settings.email.smtp.port}
                  onChange={(e) => updateSmtp("port", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpUsername">Username</Label>
                <Input
                  id="smtpUsername"
                  placeholder="username"
                  value={settings.email.smtp.username}
                  onChange={(e) => updateSmtp("username", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpPassword">Password</Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  placeholder="********"
                  value={settings.email.smtp.password}
                  onChange={(e) => updateSmtp("password", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpFromEmail">From Email</Label>
                <Input
                  id="smtpFromEmail"
                  type="email"
                  placeholder="noreply@example.com"
                  value={settings.email.smtp.fromEmail}
                  onChange={(e) => updateSmtp("fromEmail", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpFromName">From Name</Label>
                <Input
                  id="smtpFromName"
                  placeholder="Coastal CRM"
                  value={settings.email.smtp.fromName}
                  onChange={(e) => updateSmtp("fromName", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* SendGrid Fields */}
          {settings.email.provider === "sendgrid" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sendgridApiKey">API Key</Label>
                <Input
                  id="sendgridApiKey"
                  type="password"
                  placeholder="SG.xxxxxxxxxxxx"
                  value={settings.email.sendgrid.apiKey}
                  onChange={(e) => updateSendgrid("apiKey", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sendgridFromEmail">From Email</Label>
                <Input
                  id="sendgridFromEmail"
                  type="email"
                  placeholder="noreply@example.com"
                  value={settings.email.sendgrid.fromEmail}
                  onChange={(e) => updateSendgrid("fromEmail", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sendgridFromName">From Name</Label>
                <Input
                  id="sendgridFromName"
                  placeholder="Coastal CRM"
                  value={settings.email.sendgrid.fromName}
                  onChange={(e) => updateSendgrid("fromName", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Mailgun Fields */}
          {settings.email.provider === "mailgun" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mailgunApiKey">API Key</Label>
                <Input
                  id="mailgunApiKey"
                  type="password"
                  placeholder="key-xxxxxxxxxxxx"
                  value={settings.email.mailgun.apiKey}
                  onChange={(e) => updateMailgun("apiKey", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mailgunDomain">Domain</Label>
                <Input
                  id="mailgunDomain"
                  placeholder="mg.example.com"
                  value={settings.email.mailgun.domain}
                  onChange={(e) => updateMailgun("domain", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mailgunFromEmail">From Email</Label>
                <Input
                  id="mailgunFromEmail"
                  type="email"
                  placeholder="noreply@example.com"
                  value={settings.email.mailgun.fromEmail}
                  onChange={(e) => updateMailgun("fromEmail", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mailgunFromName">From Name</Label>
                <Input
                  id="mailgunFromName"
                  placeholder="Coastal CRM"
                  value={settings.email.mailgun.fromName}
                  onChange={(e) => updateMailgun("fromName", e.target.value)}
                />
              </div>
            </div>
          )}

          {settings.email.provider !== "none" && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleTestEmail}>
                  <TestTube2 className="size-4 mr-2" />
                  Test Connection
                </Button>
                <Button onClick={handleSaveEmail}>
                  <Save className="size-4 mr-2" />
                  Save
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Twilio Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Phone className="size-5" />
                Twilio - Phone Integration
              </CardTitle>
              <CardDescription>
                Connect Twilio to enable real phone calls from the dialer
              </CardDescription>
            </div>
            <Badge variant={isTwilioConfigured ? "default" : "secondary"}>
              {isTwilioConfigured ? "Connected" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="twilioSid">Account SID</Label>
              <Input
                id="twilioSid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.twilio.accountSid}
                onChange={(e) => updateTwilio("accountSid", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="twilioToken">Auth Token</Label>
              <Input
                id="twilioToken"
                type="password"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.twilio.authToken}
                onChange={(e) => updateTwilio("authToken", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="twilioPhone">Phone Number (From Number)</Label>
              <Input
                id="twilioPhone"
                placeholder="+15551234567"
                value={settings.twilio.phoneNumber}
                onChange={(e) => updateTwilio("phoneNumber", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleTestTwilio}>
              <TestTube2 className="size-4 mr-2" />
              Test Connection
            </Button>
            <Button onClick={handleSaveTwilio}>
              <Save className="size-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="size-5" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Your Company Name"
                value={settings.general.companyName}
                onChange={(e) => updateGeneral("companyName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Default Timezone</Label>
              <Select
                value={settings.general.timezone}
                onValueChange={(v) => updateGeneral("timezone", v)}
              >
                <SelectTrigger id="timezone">
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

          <Separator />

          <Button onClick={handleSaveGeneral}>
            <Save className="size-4 mr-2" />
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
