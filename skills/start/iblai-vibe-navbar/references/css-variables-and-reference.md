# Navbar — CSS variables, desktop vs mobile behavior, adding links, SDK reference

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Step 10 — CSS variables

The navbar uses CSS custom properties for theming. Add these to your
`globals.css` (or they'll fall back to defaults):

```css
:root {
  --navbar-bg: #ffffff;
  --navbar-text: #374151;
  --navbar-hover-text: #1f2937;
  --navbar-hover-bg: #f3f4f6;
  --navbar-active-text: #0058cc;
  --navbar-active-border: #0058cc;
  --border-color: #d1d5db;
  --primary-color: #0058cc;
  --text-primary: #1f2937;
  --text-secondary: #374151;
  --accent-color: #eff6ff;
  --hover-bg: #f3f4f6;
}
```

---

## Desktop vs Mobile behavior

| Breakpoint | Navbar Height | Links | Drawer |
|---|---|---|---|
| < 768px (mobile) | h-16 (64px) | Hidden | Hamburger opens Sheet drawer |
| >= 768px (desktop) | h-20 (80px) | Inline text links, `space-x-6` | Hidden |

---

## Adding more links

To add a new page link, add an entry to `NAV_LINKS`:

```tsx
// Add to NAV_LINKS array:
{ name: 'Analytics', href: '/analytics', segment: 'analytics' }
// (Analytics is not included by default — add it only if needed)
```

Links are text-only — do NOT add icons next to link labels in the navbar
or drawer.

---

## SDK component reference

For detailed props and customization of the SDK components used in
these pages, see:

- `/iblai-vibe-profile` — `Profile`, `UserProfileDropdown`, `UserProfileModal` props,
  profile content APIs, career API slice, media uploads
- `/iblai-vibe-account` — `Account` props, tab visibility, billing integration
- `/iblai-vibe-notification` — `NotificationDisplay`, `NotificationDropdown` props,
  admin vs user roles
- `/iblai-vibe-credit` — `CreditBalance` props, plan-aware action buttons,
  paywall gating, Playwright helpers
