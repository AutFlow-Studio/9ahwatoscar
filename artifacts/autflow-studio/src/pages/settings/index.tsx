import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";
import { useAgencyProfile } from "@/components/agency-profile-provider";
import { useAuth } from "@/components/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Moon, Sun, Monitor, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface AgencySettingsData {
  agencyName: string;
  agencyEmail: string;
  website: string;
  supportEmail: string;
  defaultCurrency: string;
  invoicePrefix: string;
  paymentTermsDays: number;
  notifyInvoicePaid: boolean;
  notifyDeadlineApproaching: boolean;
  notifyWeeklyDigest: boolean;
}

const DEFAULT_SETTINGS: AgencySettingsData = {
  agencyName: "AutFlow Studio",
  agencyEmail: "hello@autflowstudio.com",
  website: "",
  supportEmail: "",
  defaultCurrency: "USD",
  invoicePrefix: "INV",
  paymentTermsDays: 30,
  notifyInvoicePaid: true,
  notifyDeadlineApproaching: true,
  notifyWeeklyDigest: true,
};

export default function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const { setProfile: setAgencyProfile } = useAgencyProfile();

  // User profile draft
  const [nameDraft, setNameDraft] = useState(user?.name ?? "");
  const [emailDraft, setEmailDraft] = useState(user?.email ?? "");

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Agency settings
  const [settings, setSettings] = useState<AgencySettingsData>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    setNameDraft(user?.name ?? "");
    setEmailDraft(user?.email ?? "");
  }, [user?.name, user?.email]);

  useEffect(() => {
    fetch("/api/settings/agency", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSettings({
            agencyName: data.agencyName ?? DEFAULT_SETTINGS.agencyName,
            agencyEmail: data.agencyEmail ?? DEFAULT_SETTINGS.agencyEmail,
            website: data.website ?? "",
            supportEmail: data.supportEmail ?? "",
            defaultCurrency: data.defaultCurrency ?? "USD",
            invoicePrefix: data.invoicePrefix ?? "INV",
            paymentTermsDays: data.paymentTermsDays ?? 30,
            notifyInvoicePaid: data.notifyInvoicePaid ?? true,
            notifyDeadlineApproaching: data.notifyDeadlineApproaching ?? true,
            notifyWeeklyDigest: data.notifyWeeklyDigest ?? true,
          });
        }
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    const name = nameDraft.trim();
    const email = emailDraft.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (res.ok) {
      toast({ title: "Profile updated", description: "Your name and email have been saved." });
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: "Error", description: body.error ?? "Failed to update profile.", variant: "destructive" });
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    if (newPw.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    setPwSaving(false);
    if (res.ok) {
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      toast({ title: "Password changed", description: "Your password has been updated." });
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: "Error", description: body.error ?? "Failed to change password.", variant: "destructive" });
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/settings/agency", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        // Keep AgencyProfileProvider in sync for the sidebar
        await setAgencyProfile({
          agencyName: settings.agencyName,
          agencyEmail: settings.agencyEmail,
          website: settings.website,
        });
        toast({ title: "Settings saved", description: "Your agency profile has been updated." });
      } else {
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/settings/agency", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyInvoicePaid: settings.notifyInvoicePaid,
          notifyDeadlineApproaching: settings.notifyDeadlineApproaching,
          notifyWeeklyDigest: settings.notifyWeeklyDigest,
        }),
      });
      if (res.ok) {
        toast({ title: "Notification preferences saved" });
      } else {
        toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
      }
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <PageHeader title="Settings" description="Manage your agency operating system preferences" />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-card/40 backdrop-blur-sm border overflow-x-auto overflow-y-hidden mb-6">
          <TabsTrigger value="general" className="py-2 px-4">General</TabsTrigger>
          <TabsTrigger value="appearance" className="py-2 px-4">Appearance</TabsTrigger>
          <TabsTrigger value="notifications" className="py-2 px-4">Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="py-2 px-4">Billing & Subscriptions</TabsTrigger>
        </TabsList>

        {/* ── General Tab ────────────────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6 m-0">
          {/* My Profile */}
          <Card className="bg-card/40 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>My Profile</CardTitle>
              <CardDescription>Your personal name and email shown in the sidebar and account menu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userName">Full Name</Label>
                  <Input
                    id="userName"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSaveProfile}>Save Changes</Button>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="bg-card/40 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your login password. Must be at least 8 characters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPw">Current Password</Label>
                <Input
                  id="currentPw"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPw">New Password</Label>
                  <Input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPw">Confirm New Password</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              >
                {pwSaving ? <><Loader2 size={14} className="mr-2 animate-spin" />Saving…</> : "Change Password"}
              </Button>
            </CardContent>
          </Card>

          {/* Agency Profile */}
          {settingsLoading ? (
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading settings…</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Agency Profile</CardTitle>
                <CardDescription>Your main agency details used on invoices and reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agencyName">Agency Name</Label>
                    <Input
                      id="agencyName"
                      value={settings.agencyName}
                      onChange={(e) => setSettings((s) => ({ ...s, agencyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agencyEmail">Support Email</Label>
                    <Input
                      id="agencyEmail"
                      type="email"
                      value={settings.agencyEmail}
                      onChange={(e) => setSettings((s) => ({ ...s, agencyEmail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={settings.website}
                      onChange={(e) => setSettings((s) => ({ ...s, website: e.target.value }))}
                      placeholder="https://"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Contact Email</Label>
                    <Input
                      id="supportEmail"
                      type="email"
                      value={settings.supportEmail}
                      onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))}
                      placeholder="contact@agency.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                    <Input
                      id="invoicePrefix"
                      value={settings.invoicePrefix}
                      onChange={(e) => setSettings((s) => ({ ...s, invoicePrefix: e.target.value }))}
                      placeholder="INV"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
                    <Input
                      id="paymentTerms"
                      type="number"
                      min={0}
                      value={settings.paymentTermsDays}
                      onChange={(e) => setSettings((s) => ({ ...s, paymentTermsDays: parseInt(e.target.value, 10) || 30 }))}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveSettings} disabled={settingsSaving}>
                  {settingsSaving ? <><Loader2 size={14} className="mr-2 animate-spin" />Saving…</> : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Appearance Tab ─────────────────────────────────────────────── */}
        <TabsContent value="appearance" className="space-y-6 m-0">
          <Card className="bg-card/40 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Customize the look and feel of your dashboard. Theme preference is stored locally in this browser.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 max-w-md">
                {(["light", "dark", "system"] as const).map((t) => (
                  <div
                    key={t}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      theme === t ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                    onClick={() => setTheme(t)}
                  >
                    {t === "light" && <Sun size={24} className={theme === "light" ? "text-primary" : "text-muted-foreground"} />}
                    {t === "dark" && <Moon size={24} className={theme === "dark" ? "text-primary" : "text-muted-foreground"} />}
                    {t === "system" && <Monitor size={24} className={theme === "system" ? "text-primary" : "text-muted-foreground"} />}
                    <span className="text-sm font-medium capitalize">{t}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Notifications Tab ──────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6 m-0">
          <Card className="bg-card/40 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose what alerts you want to receive. Saved to your agency profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Invoice Paid</Label>
                      <div className="text-sm text-muted-foreground">Alert when a client pays an invoice</div>
                    </div>
                    <Switch
                      checked={settings.notifyInvoicePaid}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, notifyInvoicePaid: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Project Deadline Approaching</Label>
                      <div className="text-sm text-muted-foreground">Alert 2 days before a project deadline</div>
                    </div>
                    <Switch
                      checked={settings.notifyDeadlineApproaching}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, notifyDeadlineApproaching: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Weekly Digest</Label>
                      <div className="text-sm text-muted-foreground">Summary of your agency's performance every Monday</div>
                    </div>
                    <Switch
                      checked={settings.notifyWeeklyDigest}
                      onCheckedChange={(v) => setSettings((s) => ({ ...s, notifyWeeklyDigest: v }))}
                    />
                  </div>
                  <Button onClick={handleSaveNotifications} disabled={settingsSaving}>
                    {settingsSaving ? <><Loader2 size={14} className="mr-2 animate-spin" />Saving…</> : "Save Preferences"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Billing Tab ────────────────────────────────────────────────── */}
        <TabsContent value="billing" className="space-y-6 m-0">
          <Card className="bg-card/40 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Plan & Subscription</CardTitle>
              <CardDescription>Manage your AutFlow Studio subscription and billing details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center gap-4 border border-dashed border-border/60 rounded-xl bg-background/30">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect width="20" height="14" x="2" y="5" rx="2"/>
                    <line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Billing management coming soon</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Subscription management, usage limits, and billing history will be available in a future release.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Pro Plan · Active
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
