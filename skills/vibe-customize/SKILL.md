---
name: vibe-customize
description: Customize your app's UI with shadcn and iblai brand
globs:
alwaysApply: false
---

# /vibe-customize

Customize your app's UI while maintaining visual consistency between ibl.ai and shadcn components.

## Brand Values

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0058cc` | Brand blue -- buttons, links, active states |
| Primary Light | `#00b0ef` | Sky blue -- gradient start, highlights |
| Primary Dark | `#004499` | Deep blue -- hover states |
| Gradient | `linear-gradient(135deg, #00b0ef, #0058cc)` | Signature gradient |
| Button | `from-[#2563EB] to-[#93C5FD]` | Button gradient (Tailwind) |

## Adding shadcn/ui Components

```bash
npx shadcn@latest add button card dialog form input table tabs
```

shadcn components automatically use the same Tailwind theme as ibl.ai components (configured via components.json: new-york style, neutral base, CSS variables, Lucide icons).

## Adding shadcnspace Blocks

Pre-built page sections from https://shadcnspace.com/blocks:

```bash
npx shadcn@latest add @shadcn-space/hero-01
npx shadcn@latest add @shadcn-space/pricing-01
npx shadcn@latest add @shadcn-space/feature-01
```

After adding, update colors to match ibl.ai brand:
- Replace generic blues with `#0058cc` (primary) or `#00b0ef` (light)
- Use the gradient for hero sections and CTAs
- Keep the same font stack (system sans-serif)

## Dark Mode

Toggle with `.dark-mode` CSS class on root element. The SDK provides dark palette overrides:
- Background: `#1a1a2e`
- Surface: `#16213e`
- Card: `#1e2a4a`
- Border: `#2a3a5c`
- Text: `#e0e0e0`

## CSS Utility Classes (from SDK)

```css
.ibl-primary-bg       /* Brand blue background */
.ibl-gradient-bg      /* Signature gradient */
.ibl-button-primary   /* Gradient button */
.ibl-text-primary     /* Primary text color */
.ibl-text-secondary   /* Secondary text color */
.ibl-border           /* Default border color */
```

## Using MCP for Component Discovery

```
get_component_info("ProfileDropdown")    # Get props and usage for any SDK component
get_hook_info("useChatV2")              # Chat hook parameters and return values
```
