# SLDS Pixel-Perfect Rebuild

**Goal:** Replace the current zinc/blue Manrope UI with Salesforce Lightning Design System (SLDS) chrome and components so the CRM is visually indistinguishable from Salesforce Lightning Experience.

**Non-goals:** Use any Salesforce trademark/logo. We use SLDS (BSD-3 licensed CSS + SVG icons) only.

---

## What SLDS gives us

- **Reset CSS + design tokens** — exact SF spacing/color/radius scale
- **Salesforce Sans font** — licensed for SLDS use
- **50+ object icons** with correct colors (Account=orange, Contact=brown, Lead=pink, Opp=yellow, Case=green, Task=blue, etc.)
- **Component patterns** — page header, tab nav, list view, related list, modal, picklist, lookup, datepicker, toast, path component
- **Utility icons** — chevron, search, plus, edit, delete, more, etc.

Reference: https://www.lightningdesignsystem.com/components/overview/

---

## Visual targets to match

1. **Top header bar** — navy (#16325c), 48px tall, contains:
   - App Launcher (9-dot waffle icon) → opens app picker modal
   - Current app name + arrow (e.g. "Debt Settlement ▾")
   - Global Search input (centered, ~600px wide, "Search..." placeholder)
   - Utility icons right-aligned: ?, ⚙, 🔔 bell, avatar
2. **App Tab Nav** — white strip below header, ~38px:
   - Active tab has blue underline + bold + colored object icon
   - "+" pill for more tabs
3. **Object record page** — when viewing a Lead/Account/etc.:
   - Object icon (colored 32×32 square w/ glyph) + object name (e.g. "Lead")
   - Record name (large) + record-specific subtitle
   - Highlights bar — 4-5 key fields in a row (e.g. Phone, Email, Lead Source, Status)
   - Action buttons right-aligned: Edit, Delete, Convert, more
   - Tab nav (Details, Related, News)
   - 66/33 split: details on left, right rail for related lists + activity
4. **Object list view** — when viewing /accounts:
   - List view picker dropdown ("All Accounts ▾") with star, pinned views
   - Action bar: Refresh, List Filters, Display options, New button
   - Data table with sortable columns, row hover, inline edit pencils, selection checkboxes
5. **Forms / modals** — section dividers, 2-column field grid, "Required" red asterisks, picklist dropdowns w/ down chevron, lookup combobox

---

## File map

### New shell

| File | Purpose |
|---|---|
| `src/app/globals.css` | Import SLDS base; load Salesforce Sans @font-face |
| `src/components/slds/header.tsx` | Top navy header (replaces current sidebar+navbar) |
| `src/components/slds/app-launcher.tsx` | Waffle button + modal w/ all apps |
| `src/components/slds/tab-nav.tsx` | Object tab strip under header |
| `src/components/slds/object-header.tsx` | Record-page header w/ icon, name, highlights, actions |
| `src/components/slds/list-view.tsx` | List view picker + action bar + data table |
| `src/components/slds/related-list.tsx` | Right-rail related-records panel |
| `src/components/slds/modal.tsx` | SLDS modal |
| `src/components/slds/button.tsx` | Brand/neutral/destructive variants |
| `src/components/slds/icon.tsx` | Wrapper over SLDS SVG sprite — `<Icon set="standard" name="account" />` |
| `src/lib/slds/object-icons.ts` | Map our entity names → SLDS icon set + color |
| `src/app/(dashboard)/layout.tsx` | Use header + tab-nav instead of current sidebar |

### Page rebuilds (each follows the same pattern: list view OR record page)

Order:
1. **Phase A: shell + components** (no page changes yet, but layout swap visible immediately)
2. **Phase B**: Accounts list + detail
3. **Phase C**: Contacts, Creditors, Leads, Opportunities, Clients
4. **Phase D**: ProgramPlan, Draft, Offer, Settlement, Fee
5. **Phase E**: Task, Event, Case (incl. case comments thread)
6. **Phase F**: Email, SMS, Email Templates, Integrations
7. **Phase G**: Polish — Dashboard home page, Settings, Reports

We deploy after Phase A (so Bar can see the chrome change), then after Phase B (one full page in the new style), then continue.

---

## Object icon assignments

| Our entity | SLDS icon set | SLDS icon name | Color |
|---|---|---|---|
| Account | standard | account | orange #FE9339 |
| Contact | standard | contact | brown #A094ED — actually red-orange #F2974A |
| Lead | standard | lead | pink #F88962 |
| Opportunity | standard | opportunity | yellow #FCB95B |
| Client | standard | client | blue |
| Creditor | standard | partners | purple |
| Case | standard | case | green #F2974A |
| ProgramPlan | standard | service_contract | teal |
| Draft | standard | invoice | cyan |
| Offer | standard | quotes | purple |
| Settlement | standard | dashboard_ea | green |
| Fee | standard | currency | gold |
| Task | standard | task | green-blue |
| Event | standard | event | red |
| Email | standard | email | blue |
| SMS | standard | sms | navy |
| Campaign | standard | campaign | yellow |
| User | standard | user | blue |

(Will fine-tune to SLDS canonical mappings once installed.)

---

## What changes vs current

**Removed**: Custom sidebar (`src/components/sidebar.tsx`), Manrope font, current zinc neutrals, blue #3052ff brand color.

**Kept**: All API routes, all Prisma models, all backend logic, all auth/permissions. UI shell only.

---

## Definition of done

- [ ] `@salesforce-ux/design-system` installed
- [ ] Salesforce Sans loads
- [ ] Top SF-style navy header w/ App Launcher + Search + Avatar
- [ ] Tab nav under header with object icons
- [ ] One full record page (e.g. Account detail) matches SF Lightning visually
- [ ] One full list view (e.g. /accounts) matches SF visually
- [ ] All existing pages migrated to SLDS chrome (no zinc/blue/Manrope left)
- [ ] New SLDS pages exist for Phase 3-6 entities
- [ ] Deploys cleanly to Railway
