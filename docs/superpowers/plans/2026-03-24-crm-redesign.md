# Coastal CRM Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire Coastal CRM UI to match the approved HTML mockups in `~/coastal-crm-designs/`, switching from horizontal navbar to sidebar+topbar, updating the design system to Coastal brand (#3052FF, Manrope+Inter, tonal layering, no borders), and restyling all 19 screens.

**Architecture:** The redesign is CSS/component-level only — no changes to API routes, database schema, or data fetching logic. We update the design tokens in globals.css, replace the navbar with a sidebar+topbar layout, update shadcn/ui component styles, then restyle each page's client components to match the mockups.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui (new-york), Manrope + Inter (Google Fonts), Lucide React icons

**Reference Mockups:** `/Users/baralezrah/coastal-crm-designs/*.html`

---

## File Structure

### Foundation (design system)
- Modify: `src/app/globals.css` — Replace color tokens, add Coastal brand variables, remove borders philosophy
- Modify: `src/app/layout.tsx` — Switch fonts from Geist to Manrope + Inter via Google Fonts
- Modify: `components.json` — Update base color if needed

### Layout (sidebar + topbar)
- Create: `src/components/sidebar.tsx` — New collapsible dark navy sidebar navigation
- Create: `src/components/topbar.tsx` — New horizontal top bar (search, notifications, user)
- Modify: `src/components/navbar.tsx` — Remove (replaced by sidebar + topbar)
- Modify: `src/app/(dashboard)/layout.tsx` — Use new sidebar + topbar layout

### Shadcn/UI Component Overrides
- Modify: `src/components/ui/button.tsx` — Gradient primary variant, updated styles
- Modify: `src/components/ui/badge.tsx` — Status pillar style, updated colors
- Modify: `src/components/ui/card.tsx` — No borders, tonal backgrounds, updated radius
- Modify: `src/components/ui/input.tsx` — Surface-container-low bg, no borders
- Modify: `src/components/ui/select.tsx` — Match input style
- Modify: `src/components/ui/textarea.tsx` — Match input style
- Modify: `src/components/ui/table.tsx` — No borders, alternating tints, dense rows
- Modify: `src/components/ui/tabs.tsx` — Updated active state styling

### Pages (match mockups)
- Modify: `src/app/(auth)/login/page.tsx` — Split-screen login
- Modify: `src/components/dashboard/dashboard-content.tsx` — KPI cards, charts, tables
- Modify: `src/app/(dashboard)/leads/page.tsx` + `src/components/leads/lead-table.tsx` — Dense table with new styling
- Modify: `src/components/leads/lead-pipeline.tsx` — Kanban with colored columns
- Modify: `src/app/(dashboard)/leads/[id]/page.tsx` + `src/components/leads/lead-detail-tabs.tsx` — Detail with stat cards, timeline
- Modify: `src/app/(dashboard)/leads/[id]/edit/page.tsx` + `src/components/leads/lead-edit-form.tsx` — Two-column form
- Modify: `src/app/(dashboard)/leads/new/page.tsx` + `src/components/leads/lead-form.tsx` — Match edit form style
- Modify: `src/app/(dashboard)/opportunities/page.tsx` + `src/components/opportunities/opportunity-table.tsx` — Kanban default view
- Modify: `src/app/(dashboard)/opportunities/[id]/page.tsx` + `src/components/opportunities/opportunity-detail-tabs.tsx` — Detail with timeline
- Modify: `src/app/(dashboard)/clients/page.tsx` + `src/components/clients/client-table.tsx` — Dense table
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx` + `src/components/clients/client-detail-tabs.tsx` — Detail with debt breakdown
- Modify: `src/app/(dashboard)/reports/page.tsx` — Charts, funnel, agent table
- Modify: `src/app/(dashboard)/dialer/page.tsx` + `src/components/dialer/dialer-client.tsx` — Split-screen dialer
- Modify: `src/app/(dashboard)/campaigns/page.tsx` — Campaign table with progress bars
- Modify: `src/app/(dashboard)/campaigns/[id]/page.tsx` — Campaign detail with stats
- Modify: `src/app/(dashboard)/campaigns/new/page.tsx` — Two-panel creation form
- Modify: `src/app/(dashboard)/calls/page.tsx` — Call history table
- Modify: `src/app/(dashboard)/calls/[id]/page.tsx` — Split-screen with AI feedback
- Modify: `src/app/(dashboard)/calculator/page.tsx` + `src/components/calculator/payment-calculator.tsx` — Split calculator
- Modify: `src/app/(dashboard)/settings/page.tsx` + `src/components/settings/settings-content.tsx` — Vertical tabs + profile form

---

## Task 1: Update Design Tokens & Fonts

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `package.json` (add @fontsource or use next/font/google)

- [ ] **Step 1: Update globals.css color tokens**

Replace the existing `:root` CSS variables with Coastal brand tokens. Keep the variable names for shadcn compatibility but change values:

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: #faf8ff;
  --color-foreground: #131b2e;
  --color-card: #ffffff;
  --color-card-foreground: #131b2e;
  --color-popover: #ffffff;
  --color-popover-foreground: #131b2e;
  --color-primary: #3052ff;
  --color-primary-foreground: #ffffff;
  --color-secondary: #eaedff;
  --color-secondary-foreground: #27308a;
  --color-muted: #f2f3ff;
  --color-muted-foreground: #444656;
  --color-accent: #e2e7ff;
  --color-accent-foreground: #131b2e;
  --color-destructive: #ba1a1a;
  --color-destructive-foreground: #ffffff;
  --color-border: transparent;
  --color-input: #f2f3ff;
  --color-ring: #3052ff;
  --color-sidebar: #283044;
  --color-sidebar-foreground: #eef0ff;
  --color-sidebar-primary: #3052ff;
  --color-sidebar-primary-foreground: #ffffff;
  --color-sidebar-accent: rgba(255,255,255,0.1);
  --color-sidebar-accent-foreground: #ffffff;
  --color-sidebar-border: rgba(255,255,255,0.08);
  --color-sidebar-ring: #3052ff;
  /* Coastal-specific tokens */
  --color-surface: #faf8ff;
  --color-surface-container: #eaedff;
  --color-surface-container-low: #f2f3ff;
  --color-surface-container-high: #e2e7ff;
  --color-surface-container-highest: #dae2fd;
  --color-surface-dim: #d2d9f4;
  --color-inverse-surface: #283044;
  --color-on-surface: #131b2e;
  --color-on-surface-variant: #444656;
  --color-tertiary: #942b00;
  --color-tertiary-container: #be3900;
  --color-outline-variant: #c4c5d9;
  --color-primary-container: #0034e4;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --font-sans: 'Manrope', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

Also add utility classes at the bottom of globals.css:

```css
/* Coastal Design System Utilities */
.gradient-primary {
  background: linear-gradient(135deg, #0034e4, #3052ff);
}

.shadow-coastal {
  box-shadow: 0 12px 40px rgba(19, 27, 46, 0.06);
}

.ghost-border {
  box-shadow: inset 0 0 0 1px rgba(196, 197, 217, 0.15);
}

/* Status pillar - use as border-left */
.status-pillar {
  border-left: 3px solid currentColor;
}
```

- [ ] **Step 2: Update fonts in layout.tsx**

Replace Geist fonts with Manrope (headlines) and Inter (body) using next/font/google:

```tsx
import { Manrope, Inter } from "next/font/google";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// In the body className:
<body className={`${manrope.variable} ${inter.variable} font-sans antialiased`}>
```

- [ ] **Step 3: Verify the app still renders**

Run: `cd ~/debt-settlement-app && npm run dev`
Expected: App loads with new colors and fonts, existing components may look rough but should render.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: update design tokens to Coastal brand (#3052FF, Manrope+Inter)"
```

---

## Task 2: Create Sidebar & Topbar, Replace Navbar

**Files:**
- Create: `src/components/sidebar.tsx`
- Create: `src/components/topbar.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Reference: `~/coastal-crm-designs/dashboard.html` (for sidebar/topbar structure)

- [ ] **Step 1: Create sidebar.tsx**

Build a collapsible dark navy sidebar matching the mockup. Client component with:
- Dark navy (#283044) background, full height
- Coastal CRM logo at top
- 10 nav items with Lucide icons: LayoutDashboard, Users, Target, Briefcase, Phone, Megaphone, PhoneCall, Calculator, BarChart3, Settings
- Active state: primary blue bg pill with white text
- Collapsed mode: icons only (toggle with chevron button)
- Use `usePathname()` for active detection

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Target, Briefcase, Phone,
  Megaphone, PhoneCall, Calculator, BarChart3, Settings,
  ChevronLeft, ChevronRight
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/dialer", label: "Dialer", icon: Phone },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/calls", label: "Calls", icon: PhoneCall },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#283044] text-white flex flex-col z-50 transition-all duration-200 ${
        collapsed ? "w-[68px]" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/8">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
          C
        </div>
        {!collapsed && (
          <span className="font-sans font-bold text-lg tracking-tight">Coastal CRM</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#3052ff] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="font-[var(--font-body)]">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-white/8 text-white/40 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
```

- [ ] **Step 2: Create topbar.tsx**

Build the horizontal top bar:

```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { Search, Bell } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <header className="h-16 bg-white flex items-center justify-between px-6 shadow-coastal">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444656]" />
        <input
          type="text"
          placeholder="Search leads, clients, calls..."
          className="w-full pl-10 pr-4 py-2 bg-[#f2f3ff] rounded-lg text-sm font-[var(--font-body)] text-[#131b2e] placeholder:text-[#444656] focus:outline-none focus:ring-2 focus:ring-[#3052ff]/20"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-[#f2f3ff] transition-colors">
          <Bell className="w-5 h-5 text-[#444656]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#3052ff] rounded-full" />
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#f2f3ff] transition-colors">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <span className="text-sm font-medium text-[#131b2e] font-[var(--font-body)] hidden md:block">
                {user?.name || "User"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-xs text-[#444656]">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Update dashboard layout to use sidebar + topbar**

Modify `src/app/(dashboard)/layout.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <Sidebar />
      <div className="ml-[240px] transition-all duration-200">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Remove old navbar import**

The old `navbar.tsx` is no longer imported from the dashboard layout. Keep the file for reference but it's no longer used.

- [ ] **Step 5: Verify sidebar + topbar renders**

Run: `npm run dev`
Expected: App shows dark navy sidebar on left, top bar with search, main content area on right.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/components/topbar.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: replace horizontal navbar with sidebar + topbar layout"
```

---

## Task 3: Update Shadcn/UI Component Styles

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/table.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/ui/select.tsx`

- [ ] **Step 1: Update button.tsx — add gradient variant**

Add a `gradient` variant to the button's CVA config:

```tsx
gradient: "text-white gradient-primary hover:opacity-90 shadow-coastal",
```

- [ ] **Step 2: Update card.tsx — remove borders, add tonal bg**

Update Card's className: remove `border` classes, use `bg-white rounded-xl shadow-coastal` instead.

- [ ] **Step 3: Update input.tsx and textarea.tsx — no borders, tonal bg**

Update Input className to: `bg-[#f2f3ff] border-0 rounded-lg text-sm font-[var(--font-body)] focus-visible:ring-2 focus-visible:ring-[#3052ff]/20 focus-visible:ring-offset-0`

Same for textarea.

- [ ] **Step 4: Update table.tsx — no borders, alternating rows**

Remove border classes from TableHeader, TableRow, TableCell. Add `even:bg-[#f2f3ff]` to TableRow. Use `text-xs font-medium uppercase tracking-wider text-[#444656]` for TableHead.

- [ ] **Step 5: Update badge.tsx — add status color variants**

Add variants: `qualified` (green), `new` (blue), `contacted` (yellow), `lost` (red), `active` (green), `paused` (yellow), `completed` (blue), `draft` (gray).

- [ ] **Step 6: Update tabs.tsx — coastal styling**

Update TabsList to `bg-[#f2f3ff] rounded-lg`. Update TabsTrigger active state to `bg-white shadow-coastal text-[#3052ff]`.

- [ ] **Step 7: Update select.tsx — match input style**

Same bg/border treatment as input.

- [ ] **Step 8: Verify components render correctly**

Run: `npm run dev`, check dashboard page.
Expected: Updated button, card, input styles visible.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/
git commit -m "feat: update shadcn/ui components to Coastal design system"
```

---

## Task 4: Redesign Login Page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Reference: `~/coastal-crm-designs/login.html`

- [ ] **Step 1: Read current login page**

Read `src/app/(auth)/login/page.tsx` to understand current structure and form logic.

- [ ] **Step 2: Redesign to split-screen layout**

Rewrite the JSX to match the mockup:
- Full-screen flex container, no sidebar/topbar
- Left 55%: dark navy bg (#283044), centered Coastal CRM logo + tagline, decorative CSS element
- Right 45%: white bg, centered form with "Welcome back" heading, email/password inputs, remember me, gradient Sign In button, forgot password link
- Preserve all existing form submission logic, useActionState, error handling

- [ ] **Step 3: Verify login page**

Navigate to `/login`. Expected: Split-screen design matching mockup.

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat: redesign login page with split-screen layout"
```

---

## Task 5: Redesign Dashboard

**Files:**
- Modify: `src/components/dashboard/dashboard-content.tsx`
- Reference: `~/coastal-crm-designs/dashboard.html`

- [ ] **Step 1: Read current dashboard component**

Read `src/components/dashboard/dashboard-content.tsx` to understand data fetching and state.

- [ ] **Step 2: Redesign dashboard layout**

Rewrite JSX to match mockup:
- Greeting "Good morning, {name}" with date
- 4 KPI stat cards in a row (white bg, icon, value, label, % change badge)
- 2 charts side by side (CSS bar chart for pipeline, area chart for revenue)
- Recent Calls table + Top Agents leaderboard side by side
- Upcoming Follow-ups table
- Use tonal backgrounds, no borders, Coastal tokens
- Preserve all existing data fetching and API calls

- [ ] **Step 3: Verify dashboard**

Navigate to `/dashboard`. Expected: New layout matching mockup.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/
git commit -m "feat: redesign dashboard with KPI cards, charts, and data tables"
```

---

## Task 6: Redesign Leads List & Pipeline

**Files:**
- Modify: `src/app/(dashboard)/leads/page.tsx`
- Modify: `src/components/leads/lead-table.tsx`
- Modify: `src/components/leads/lead-pipeline.tsx`
- Reference: `~/coastal-crm-designs/leads-list.html`, `~/coastal-crm-designs/leads-pipeline.html`

- [ ] **Step 1: Read current leads page and components**

Read page.tsx, lead-table.tsx, and lead-pipeline.tsx.

- [ ] **Step 2: Update leads page header**

Add view toggle buttons (Table/Pipeline), filter bar with dropdowns, "+ Add Lead" gradient button. Match mockup header layout.

- [ ] **Step 3: Redesign lead-table.tsx**

Dense table matching mockup: checkbox column, lead name (business + contact stacked), phone, email, debt estimate, source, colored status badges, assigned to, last contact, 3-dot menu. Alternating row tints, no borders.

- [ ] **Step 4: Redesign lead-pipeline.tsx**

Kanban board: 6 columns (New, Contacted, Qualified, Proposal, Enrolled, Lost) with color-coded headers, scrollable columns, cards with left-edge status pillar, business name, contact, debt, agent avatar, days in stage.

- [ ] **Step 5: Verify both views**

Test table view and pipeline view at `/leads`. Expected: Both match mockups.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/leads/page.tsx src/components/leads/
git commit -m "feat: redesign leads list with dense table and kanban pipeline views"
```

---

## Task 7: Redesign Lead Detail & Edit

**Files:**
- Modify: `src/components/leads/lead-detail-tabs.tsx`
- Modify: `src/components/leads/lead-edit-form.tsx`
- Modify: `src/components/leads/lead-form.tsx`
- Reference: `~/coastal-crm-designs/lead-detail.html`, `~/coastal-crm-designs/lead-edit.html`

- [ ] **Step 1: Read current lead detail and edit components**

- [ ] **Step 2: Redesign lead-detail-tabs.tsx**

Match mockup: breadcrumb, lead name header with status badge + lead score circle, 4 mini stat cards, tabbed interface. Overview tab: left column contact info grid + activity timeline, right column agent card + tasks + tags. Preserve existing data structure and tab logic.

- [ ] **Step 3: Redesign lead-edit-form.tsx and lead-form.tsx**

Two-column form layout matching mockup. Left: business/contact fields. Right: lead management fields. Bottom: UTM section. Inputs use surface-container-low bg, no borders. Preserve form logic and validation.

- [ ] **Step 4: Verify detail and edit pages**

Navigate to a lead detail and edit page. Expected: Match mockups.

- [ ] **Step 5: Commit**

```bash
git add src/components/leads/
git commit -m "feat: redesign lead detail and edit pages"
```

---

## Task 8: Redesign Opportunities Pages

**Files:**
- Modify: `src/app/(dashboard)/opportunities/page.tsx`
- Modify: `src/components/opportunities/opportunity-table.tsx`
- Modify: `src/components/opportunities/opportunity-detail-tabs.tsx`
- Modify: `src/components/opportunities/opportunity-edit-form.tsx`
- Reference: `~/coastal-crm-designs/opportunities-list.html`, `~/coastal-crm-designs/opportunity-detail.html`

- [ ] **Step 1: Read current opportunity components**

- [ ] **Step 2: Redesign opportunities list as kanban-default**

Add kanban view as default (like leads pipeline). 6 stage columns: Qualification, Proposal, Negotiation, Closing, Won, Lost. Cards with debt amount, negotiator, close date, days in stage. Also support table view toggle.

- [ ] **Step 3: Redesign opportunity detail**

Match mockup: stage badge, stat cards (debt, settlement target, monthly payment, days in stage), tabbed interface with timeline, negotiator card.

- [ ] **Step 4: Update opportunity edit form**

Match Coastal input styles. Two-column layout.

- [ ] **Step 5: Verify opportunities pages**

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/opportunities/ src/components/opportunities/
git commit -m "feat: redesign opportunities with kanban view and detail pages"
```

---

## Task 9: Redesign Clients Pages

**Files:**
- Modify: `src/app/(dashboard)/clients/page.tsx`
- Modify: `src/components/clients/client-table.tsx`
- Modify: `src/components/clients/client-detail-tabs.tsx`
- Reference: `~/coastal-crm-designs/clients-list.html`, `~/coastal-crm-designs/client-detail.html`

- [ ] **Step 1: Read current client components**

- [ ] **Step 2: Redesign clients list**

Dense table: client name, phone, total debt, amount settled, savings %, program start, status badge, negotiator. Alternating rows, no borders.

- [ ] **Step 3: Redesign client detail**

Match mockup: stat cards (enrolled debt, settled, monthly payment, savings rate), tabbed interface, debt breakdown table, payment history chart, program timeline progress bar.

- [ ] **Step 4: Verify clients pages**

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/clients/ src/components/clients/
git commit -m "feat: redesign clients list and detail pages"
```

---

## Task 10: Redesign Reports

**Files:**
- Modify: `src/app/(dashboard)/reports/page.tsx`
- Reference: `~/coastal-crm-designs/reports.html`

- [ ] **Step 1: Read current reports page**

- [ ] **Step 2: Redesign reports dashboard**

Match mockup: date range picker, 4 summary cards, settlement performance bar chart, lead conversion funnel, agent performance table, debt portfolio breakdown. All CSS-based charts.

- [ ] **Step 3: Verify reports page**

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/reports/
git commit -m "feat: redesign reports dashboard with charts and analytics"
```

---

## Task 11: Redesign Dialer

**Files:**
- Modify: `src/app/(dashboard)/dialer/page.tsx`
- Modify: `src/components/dialer/dialer-client.tsx`
- Reference: `~/coastal-crm-designs/dialer.html`

- [ ] **Step 1: Read current dialer components**

- [ ] **Step 2: Redesign as split-screen**

Match mockup: top campaign bar, left panel (45%) with phone display, dial/hangup buttons, timer, disposition buttons, notes, next/skip. Right panel (55%) with lead info, previous calls, call script. Tonal separation between panels. Preserve all dialer logic.

- [ ] **Step 3: Verify dialer**

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/dialer/ src/components/dialer/
git commit -m "feat: redesign dialer with split-screen layout"
```

---

## Task 12: Redesign Campaigns Pages

**Files:**
- Modify: `src/app/(dashboard)/campaigns/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/[id]/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/new/page.tsx`
- Reference: `~/coastal-crm-designs/campaigns-list.html`, `~/coastal-crm-designs/campaign-detail.html`, `~/coastal-crm-designs/campaign-new.html`

- [ ] **Step 1: Read current campaign components**

- [ ] **Step 2: Redesign campaigns list**

Table with progress bars for dialed ratio, status badges, dialer mode labels. Match mockup.

- [ ] **Step 3: Redesign campaign detail**

5 stat cards with progress indicators, tabbed contacts table, agent assignment cards. Match mockup.

- [ ] **Step 4: Redesign new campaign form**

Two-panel: left 65% form (details, dialer mode radio cards, schedule, script), right 35% sidebar (contact list, agent assignment). Match mockup.

- [ ] **Step 5: Verify all campaign pages**

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/campaigns/
git commit -m "feat: redesign campaign list, detail, and creation pages"
```

---

## Task 13: Redesign Calls Pages

**Files:**
- Modify: `src/app/(dashboard)/calls/page.tsx`
- Modify: `src/app/(dashboard)/calls/[id]/page.tsx`
- Reference: `~/coastal-crm-designs/calls-list.html`, `~/coastal-crm-designs/call-detail.html`

- [ ] **Step 1: Read current calls components**

- [ ] **Step 2: Redesign calls list**

Dense table with filter bar (agent, disposition, campaign, direction, date range, search), direction arrows, disposition badges, play buttons, pagination. Match mockup.

- [ ] **Step 3: Redesign call detail with AI feedback**

Split layout: left 55% transcript (summary box + speaker blocks with alternating bg), right 45% AI intelligence panel (score ring, talk ratio, metrics, strength/improvement badges, key moments). Match mockup.

- [ ] **Step 4: Verify calls pages**

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/calls/
git commit -m "feat: redesign calls list and detail with AI feedback panel"
```

---

## Task 14: Redesign Calculator

**Files:**
- Modify: `src/app/(dashboard)/calculator/page.tsx`
- Modify: `src/components/calculator/payment-calculator.tsx`
- Reference: `~/coastal-crm-designs/calculator.html`

- [ ] **Step 1: Read current calculator component**

- [ ] **Step 2: Redesign as split layout**

Left: input form (debt, creditors, rate, target slider, duration, fee, calculate button). Right: results (hero amount, metrics grid, comparison chart, amortization table). Match mockup. Preserve calculation logic.

- [ ] **Step 3: Verify calculator**

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/calculator/ src/components/calculator/
git commit -m "feat: redesign calculator with split input/results layout"
```

---

## Task 15: Redesign Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/components/settings/settings-content.tsx`
- Reference: `~/coastal-crm-designs/settings.html`

- [ ] **Step 1: Read current settings component**

- [ ] **Step 2: Redesign with vertical tabs**

Left panel: vertical tab nav (Profile active, Team, Integrations, Notifications, Billing). Profile tab: two-column form with avatar, fields, password section, notification toggles. Match mockup. Preserve settings logic.

- [ ] **Step 3: Verify settings page**

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/ src/components/settings/
git commit -m "feat: redesign settings page with vertical tab navigation"
```

---

## Task 16: Mobile Responsiveness Pass

**Files:**
- Modify: `src/components/sidebar.tsx` — Add mobile drawer behavior
- Modify: `src/components/topbar.tsx` — Add hamburger for mobile
- Modify: Various page components for responsive grids

- [ ] **Step 1: Add mobile sidebar behavior**

On screens < 768px: sidebar is hidden by default, opens as an overlay drawer. Add hamburger menu button to topbar on mobile. Use Sheet component for mobile sidebar.

- [ ] **Step 2: Update topbar for mobile**

Show hamburger icon on mobile (md:hidden). Search collapses to icon on mobile.

- [ ] **Step 3: Test key pages on mobile viewport**

Check dashboard, leads list, lead detail, dialer at 375px width.

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar.tsx src/components/topbar.tsx
git commit -m "feat: add mobile responsive sidebar drawer and topbar"
```

---

## Task 17: Final QA & Cleanup

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 2: Visual QA all pages**

Open each page in the browser and compare with mockups. Note any discrepancies.

- [ ] **Step 3: Remove old navbar.tsx if no longer referenced**

Check for any remaining imports of the old navbar. Remove if unused.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: cleanup old navbar, final QA fixes for CRM redesign"
```
