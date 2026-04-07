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

---

## Apple-Inspired Design Language

The visual design language for ibl.ai apps draws inspiration from Apple's
design system. Use the guidelines below for layout, typography rhythm,
component styling, and responsive behavior when building custom UI.

### Visual Theme

Controlled minimalism -- vast expanses of solid backgrounds serve as backdrops
for content. The interface retreats until it becomes invisible.

**Key Characteristics:**
- System sans-serif with tight headline line-heights (1.07-1.14)
- Binary light/dark section rhythm: black (`#000000`) alternating with light gray (`#f5f5f7`)
- Single accent color for interactive elements
- Full-width section layout with centered content
- Pill-shaped CTAs (980px radius)
- Generous whitespace between sections

### Apple Color Roles

| Role | Light BG | Dark BG |
|------|----------|---------|
| Background | `#f5f5f7` | `#000000` |
| Text | `#1d1d1f` | `#ffffff` |
| Secondary text | `rgba(0,0,0,0.8)` | `#ffffff` |
| Interactive / CTA | `#0071e3` | `#0071e3` |
| Link | `#0066cc` | `#2997ff` |
| Card surface | `#f5f5f7` | `#272729` - `#2a2a2d` |
| Focus ring | `#0071e3` | `#0071e3` |

### Apple Typography Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Display Hero | 56px (3.50rem) | 600 | 1.07 | -0.28px |
| Section Heading | 40px (2.50rem) | 600 | 1.10 | normal |
| Tile Heading | 28px (1.75rem) | 400 | 1.14 | 0.196px |
| Card Title | 21px (1.31rem) | 700 | 1.19 | 0.231px |
| Body | 17px (1.06rem) | 400 | 1.47 | -0.374px |
| Button | 17px (1.06rem) | 400 | 1.00 | normal |
| Link / Caption | 14px (0.88rem) | 400 | 1.43 | -0.224px |
| Micro | 12px (0.75rem) | 400 | 1.33 | -0.12px |

**Principles:**
- Negative letter-spacing at all sizes (not just headlines)
- Weight restraint: mostly 400 (regular) and 600 (semibold), max 700
- Extreme line-height range: 1.07 for headlines, 1.47 for body

### Apple Component Styles

**Buttons**
- Primary CTA: `#0071e3` bg, white text, 8px radius, 8px 15px padding
- Secondary CTA: `#1d1d1f` bg, white text, 8px radius
- Pill link: transparent bg, `#0066cc` text, 980px radius, 1px border
- Focus: `2px solid #0071e3` outline

**Cards & Containers**
- Light: `#f5f5f7` bg, no border, 5-8px radius
- Dark: `#272729`-`#2a2a2d` bg, no border
- Shadow (rare): `rgba(0,0,0,0.22) 3px 5px 30px 0px`
- No hover state on cards -- links within them are interactive

**Navigation**
- `rgba(0,0,0,0.8)` bg with `backdrop-filter: saturate(180%) blur(20px)`
- 48px height, white text at 12px weight 400
- Floats above content with glass effect

### Apple Layout Principles

- Base spacing unit: 8px
- Max content width: ~980px centered
- Full-viewport-width sections with centered content blocks
- Alternating background colors create section separation (no borders)
- Each section near full-viewport height

**Border Radius Scale:**
- 5px: small containers
- 8px: buttons, cards
- 11px: search inputs
- 12px: feature panels
- 980px: pill CTAs
- 50%: media controls

### Apple Depth & Elevation

| Level | Treatment |
|-------|-----------|
| Flat | No shadow, solid background |
| Navigation Glass | `backdrop-filter: saturate(180%) blur(20px)` on `rgba(0,0,0,0.8)` |
| Subtle Lift | `rgba(0,0,0,0.22) 3px 5px 30px 0px` |
| Focus | `2px solid #0071e3` outline |

Shadow is rare and always soft. Elevation comes from background color contrast.

### Apple Responsive Breakpoints

| Name | Width |
|------|-------|
| Mobile | 360-480px |
| Tablet | 640-1024px |
| Desktop | 1024-1440px |
| Large Desktop | >1440px |

- Hero headlines: 56px -> 40px -> 28px on mobile
- Grids: 3-col -> 2-col -> 1-col
- Nav: horizontal -> hamburger
- Touch targets: minimum 44x44px

### Do's and Don'ts

**Do:**
- Use a single accent color for all interactive elements
- Alternate light/dark section backgrounds for rhythm
- Apply negative letter-spacing at all text sizes
- Compress headline line-heights (1.07-1.14)
- Use the glass blur effect for sticky navigation
- Keep product imagery on solid color fields

**Don't:**
- Don't introduce additional accent colors
- Don't use heavy shadows or multiple shadow layers
- Don't use borders on cards or containers
- Don't use font weight 800 or 900
- Don't add textures, patterns, or gradients to backgrounds
- Don't make the navigation opaque
- Don't center-align body text (only headlines)
