# ibl.ai Brand Identity

Brand guidelines for building consistent ibl.ai applications. Based on the
`@iblai/iblai-js` SDK design system (`web-containers/src/styles/base.css`).

---

## Color Palette

### Primary

| Token | Hex | OKLCH | Usage |
|-------|-----|-------|-------|
| Primary | `#0058cc` | `oklch(0.492 0.194 259.3)` | Brand blue -- buttons, links, active states |
| Primary Light | `#00b0ef` | `oklch(0.713 0.148 233.2)` | Sky blue -- gradient start, highlights |
| Primary Dark | `#004499` | `oklch(0.406 0.152 258.2)` | Deep blue -- hover states, emphasis |
| Chat Primary | `#3b82f6` | `oklch(0.623 0.188 259.8)` | Chat interface elements |
| Avatar BG | `#0ea5e9` | `oklch(0.670 0.148 230.5)` | Default avatar background |
| Link | `#0058cc` | `oklch(0.492 0.194 259.3)` | Link text |
| Link Hover | `#004499` | `oklch(0.406 0.152 258.2)` | Link hover |

### shadcn CSS Variables

Generated apps map ibl.ai tokens to shadcn CSS variables in `globals.css` using OKLCH values.
shadcn components (`bg-primary`, `text-muted-foreground`, `border-border`, etc.) automatically
use the ibl.ai brand colors. No additional theme configuration needed.

### Brand Gradient

The signature ibl.ai gradient -- sky-blue to deep-blue at 135 degrees:

```css
background: linear-gradient(135deg, #00b0ef, #0058cc);
```

Button gradient (Tailwind classes):

```html
<button class="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white">
```

### Status Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Success | `#10b981` | Confirmations, completed states |
| Warning | `#f59e0b` | Caution, pending states |
| Error | `#ef4444` | Errors, destructive actions |
| Info | `#3b82f6` | Informational elements |

### Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#ffffff` | Page background |
| Surface | `#fafbfc` | Sidebar, secondary surfaces |
| Accent | `#f6f8fe` | Subtle highlights |
| Input BG | `#f9fafb` | Form input backgrounds |
| Hover BG | `#f3f4f6` | Hover states |
| Card BG | `#ffffff` | Card backgrounds |
| Border | `#e5e7eb` | Default borders |
| Separator | `#d1d5db` | Dividers |
| Text Primary | `#616a76` | Body text |
| Text Secondary | `#717985` | Secondary/muted text |
| Text Muted | `#9ca3af` | Placeholder, disabled text |

---

## Typography

System sans-serif font stack (no custom fonts required):

```css
font-family: ui-sans-serif, system-ui, sans-serif,
  'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
```

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Subtle text, captions |
| Normal | 400 | Body text |
| Medium | 500 | Emphasis, labels |
| Semibold | 600 | Headings, buttons |
| Bold | 700 | Strong emphasis |

### Font Sizes

| Token | Size | Usage |
|-------|------|-------|
| xs | 0.75rem (12px) | Badges, footnotes |
| sm | 0.875rem (14px) | Secondary text, labels |
| base | 1rem (16px) | Body text |
| lg | 1.125rem (18px) | Section headers |
| xl | 1.25rem (20px) | Page titles |
| 2xl | 1.5rem (24px) | Hero text |
| 3xl | 1.875rem (30px) | Large headings |
| 4xl | 2.25rem (36px) | Display text |

---

## Spacing Scale

| Token | Value | Pixels |
|-------|-------|--------|
| xs | 0.25rem | 4px |
| sm | 0.5rem | 8px |
| md | 1rem | 16px |
| lg | 1.5rem | 24px |
| xl | 2rem | 32px |
| 2xl | 3rem | 48px |

---

## Border Radius

| Token | Value | Pixels |
|-------|-------|--------|
| sm | 0.25rem | 4px |
| md | 0.375rem | 6px |
| lg | 0.5rem | 8px |
| xl | 0.75rem | 12px |
| 2xl | 1rem | 16px |
| full | 9999px | Pill/circle |

---

## Shadows

| Token | Value |
|-------|-------|
| sm | `0 1px 2px 0 rgb(0 0 0 / 0.05)` |
| md | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| lg | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |
| xl | `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` |

---

## Component Style

| Setting | Value |
|---------|-------|
| UI framework | shadcn/ui with Radix UI primitives |
| Style variant | `new-york` |
| Base color | `neutral` |
| CSS variables | Enabled |
| Icon library | Lucide React |

---

## CSS Utility Classes

The SDK provides utility classes for common brand patterns:

```css
/* Backgrounds */
.ibl-primary-bg      { background-color: var(--primary-color); }
.ibl-gradient-bg      { background: linear-gradient(135deg, var(--primary-light), var(--primary-color)); }
.ibl-surface-bg       { background-color: var(--sidebar-bg); }

/* Buttons */
.ibl-button-primary   { @apply bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white; }
.ibl-outline-primary  { @apply border-[#2563EB] text-[#2563EB]; }

/* Text */
.ibl-text-primary     { color: var(--text-primary); }
.ibl-text-secondary   { color: var(--text-secondary); }
.ibl-text-muted       { color: var(--text-muted); }
.ibl-text-link        { color: var(--link-color); }

/* Borders */
.ibl-border           { border-color: var(--border-color); }
.ibl-separator        { border-color: var(--separator-color); }
```

---

## Dark Mode

The SDK supports dark mode via the `.dark-mode` CSS class. Dark mode
overrides the CSS custom properties with a dark palette:

| Token | Light | Dark |
|-------|-------|------|
| Background | `#ffffff` | `#1a1a2e` |
| Surface | `#fafbfc` | `#16213e` |
| Card BG | `#ffffff` | `#1e2a4a` |
| Border | `#e5e7eb` | `#2a3a5c` |
| Text Primary | `#616a76` | `#e0e0e0` |
| Text Secondary | `#717985` | `#b0b0b0` |

Toggle dark mode by adding/removing the `.dark-mode` class on the root element.

---

## Using with shadcn Components

When adding shadcn UI components, the brand values above are already mapped
to shadcn CSS variables in `globals.css`. A shadcn `bg-primary` button renders
in ibl.ai blue (`#0058cc`), not the default shadcn black. No manual theme work
needed.

```bash
npx shadcn@latest add button dialog table form
```

For pre-built page sections (hero, pricing, features):

```bash
npx shadcn@latest add @shadcn-space/<block-name>
```

Browse: https://shadcnspace.com/blocks

---

## Source of Truth

The canonical design tokens are in the `@iblai/iblai-js` SDK:

```
packages/web-containers/src/styles/base.css
```

All hex values, spacing scales, and utility classes in this document
are derived from that file. When in doubt, check `base.css`.
