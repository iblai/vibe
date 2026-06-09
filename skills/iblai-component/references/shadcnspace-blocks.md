# Add shadcnspace Components with ibl.ai Brand Consistency

Add pre-built UI blocks from [shadcnspace](https://shadcnspace.com) to your
ibl.ai app while maintaining brand consistency with SDK components.

---

## Quick Start

```bash
# Browse blocks at https://shadcnspace.com/blocks
npx shadcn@latest add @shadcn-space/<block-name>
```

Components are installed to `components/ui/` and integrate with the existing
Tailwind CSS configuration. The `components.json` in your project root
configures shadcn/ui with the "new-york" style and "neutral" base color.

---

## How It Works

Your project has a `components.json` that configures the shadcn CLI:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

When you run `npx shadcn@latest add`, it reads this config and installs
components to the correct location with the correct import paths.

---

## Theme Integration

**shadcn components automatically use ibl.ai brand colors.** The generated
`globals.css` maps ibl.ai design tokens to shadcn CSS variables (OKLCH values).
When you add a shadcn button, it renders in ibl.ai blue (#0058cc) — no manual
theme work needed.

For example, `className="bg-primary"` resolves to the ibl.ai brand blue,
`className="text-muted-foreground"` resolves to the ibl.ai text-secondary color,
and `className="border-border"` uses the ibl.ai border color.

## ibl.ai Brand Identity

The ibl.ai SDK defines a complete design system. When adding shadcnspace
blocks, use these values to maintain visual consistency.

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#0058cc` | Brand blue — buttons, links, active states |
| Primary Light | `#00b0ef` | Sky blue — gradient start, highlights |
| Primary Dark | `#004499` | Deep blue — hover states, emphasis |
| Chat Primary | `#3b82f6` | Chat interface elements |
| Success | `#10b981` | Success states, confirmations |
| Warning | `#f59e0b` | Warnings, caution |
| Error | `#ef4444` | Errors, destructive actions |
| Info | `#3b82f6` | Informational elements |

### Brand Gradient

```css
/* The signature ibl.ai gradient — sky-blue to deep-blue */
background: linear-gradient(135deg, #00b0ef, #0058cc);

/* Button gradient (Tailwind classes) */
className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white"
```

### Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#ffffff` | Page background |
| Surface | `#fafbfc` | Sidebar, secondary surfaces |
| Input BG | `#f9fafb` | Form input backgrounds |
| Hover BG | `#f3f4f6` | Hover states |
| Border | `#e5e7eb` | Default borders |
| Separator | `#d1d5db` | Dividers, separators |
| Text Primary | `#616a76` | Body text |
| Text Secondary | `#717985` | Secondary/muted text |
| Text Muted | `#9ca3af` | Placeholder, disabled text |

### Full Brand Guide

For the complete design system — typography, spacing scale, border radius,
shadows, dark mode, and all CSS utility classes — see [BRAND.md](../../BRAND.md).

### CSS Utility Classes (Quick Reference)

```css
/* Backgrounds */
.ibl-primary-bg     { background-color: #0058cc; }
.ibl-gradient-bg     { background: linear-gradient(135deg, #00b0ef, #0058cc); }
.ibl-surface-bg      { background-color: #fafbfc; }

/* Buttons */
.ibl-button-primary  { @apply bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white; }
.ibl-outline-primary { @apply border-[#2563EB] text-[#2563EB]; }

/* Text */
.ibl-text-primary    { color: #616a76; }
.ibl-text-link       { color: #0058cc; }

/* Borders */
.ibl-border          { border-color: #e5e7eb; }
```

---

## Recommended Block Categories

When choosing shadcnspace blocks for your ibl.ai app, these categories
integrate well with the existing SDK components:

### Dashboard Layouts

Best for apps with sidebar navigation, content areas, and embedded
AI chat. The `AppShell` component already provides sidebar + main
content layout — dashboard blocks extend the main content area.

### Hero Sections

For landing pages or onboarding screens. Use the ibl.ai gradient
(`from-[#2563EB] to-[#93C5FD]`) for primary call-to-action buttons.

### Navigation

The SDK provides `ProfileDropdown` and `IblaiNotificationBell` for
the navbar. shadcnspace navigation blocks can provide the overall
header structure that houses these components.

### Cards and Stats

For analytics dashboards, user metrics, or content displays.
Use the neutral palette (`#fafbfc` backgrounds, `#e5e7eb` borders)
to match the SDK's visual language.

### Tables and Data Display

For listing conversations, users, or other data. Use `#f9fafb` for
alternating row backgrounds and `#e5e7eb` for cell borders.

### Pricing and Feature Pages

For SaaS features. Use the brand gradient on primary CTAs and
`#10b981` (success green) for checkmark/included indicators.

---

## Composing with ibl.ai Components

### Embedding ChatWidget in a Dashboard

```tsx
import { ChatWidget } from "@/components/iblai/chat-widget";

// Inside your dashboard layout:
<div className="flex h-screen">
  <aside className="w-80 border-r border-[#e5e7eb]">
    <ChatWidget />
  </aside>
  <main className="flex-1 p-6">
    {/* Your shadcnspace dashboard content */}
  </main>
</div>
```

### Adding ProfileDropdown to a Navigation Block

```tsx
import { ProfileDropdown } from "@/components/iblai/profile-dropdown";

// Inside a shadcnspace header/navbar:
<header className="flex items-center justify-between px-6 py-3 border-b border-[#e5e7eb]">
  <div>{/* Logo + nav links */}</div>
  <div className="flex items-center gap-4">
    <IblaiNotificationBell />
    <ProfileDropdown />
  </div>
</header>
```

### Adding NotificationBell to a Header

```tsx
import { IblaiNotificationBell } from "@/components/iblai/notification-bell";

// Place in any header/toolbar:
<IblaiNotificationBell />
```

### Provider Requirements

ibl.ai components require the provider hierarchy to be set up.
If your page is inside the `(app)/` route group, providers are
already active. If adding components outside the route group,
wrap them with `<IblaiProviders>`.

---

## Customizing Blocks for Brand Consistency

When a shadcnspace block uses generic colors, replace them with
ibl.ai brand values:

### Replace Default Blue

```tsx
// shadcnspace default:
className="bg-blue-600 text-white"

// ibl.ai brand:
className="bg-[#0058cc] text-white"
// or use the gradient:
className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white"
```

### Replace Default Borders

```tsx
// shadcnspace default:
className="border border-gray-200"

// ibl.ai brand:
className="border border-[#e5e7eb]"
// or use the utility class:
className="border ibl-border"
```

### Replace Default Backgrounds

```tsx
// shadcnspace default:
className="bg-gray-50"

// ibl.ai brand:
className="bg-[#fafbfc]"
```

### Use the Icon Library

ibl.ai apps use **Lucide React** for icons (same as shadcn/ui):

```tsx
import { Search, Bell, User, Settings } from "lucide-react";
```

---

## Troubleshooting

### "components.json not found"

Ensure `components.json` exists in the project root. It should have
been generated by `iblai startapp` or `iblai add builds`.

### Component styles don't match

Make sure `app/globals.css` imports the SDK styles:
```css
@import '@iblai/iblai-js/web-containers/styles';
```

And scans SDK components for Tailwind class generation:
```css
@source "../node_modules/@iblai/iblai-js/dist/web-containers/source";
```

### Block uses wrong colors

After adding a shadcnspace block, search for hardcoded color classes
(like `bg-blue-600`, `text-gray-500`) and replace with ibl.ai brand
values from the palette table above.
