---
name: iblai-design
description: "Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Falls back to the ibl.ai BRAND.md design system when the project has none. Not for backend-only or non-UI tasks."
argument-hint: "[craft|shape|teach|document|extract · critique|audit · polish|bolder|quieter|distill|harden|onboard · animate|colorize|typeset|layout|delight|overdrive · clarify|adapt|optimize · live] [target]"
globs:
alwaysApply: false
user-invocable: true
allowed-tools:
  - Bash(npx impeccable *)
license: Apache-2.0. Based on Anthropic's frontend-design skill (https://github.com/anthropics/skills, Copyright 2025 Anthropic PBC); extended by Impeccable (Copyright 2025-2026 Paul Bakaus).
---

# /iblai-design

Builds and refines shippable frontend interfaces for ibl.ai apps: real working code, decisive design calls, and craft that holds up under inspection.

[BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
is the **default** design system (colors, typography, spacing, radius, shadows,
component style). When the project already carries its own design system
(a v0 export, a custom theme, a partner-branded shell, a `DESIGN.md`/`PRODUCT.md`),
**defer to that instead**. See [ibl.ai design defaults](#iblai-design-defaults-brandmd-fallback) below.

## Setup

> **Project-scoped skill.** Scripts are invoked by the relative path
> `node .claude/skills/iblai-design/scripts/<x>.mjs`, resolved against the
> project root (cwd). The skill must live at
> `<project>/.claude/skills/iblai-design/` (the `skills/` → `.claude/skills/`
> symlink that vibe sets up at install). A user-global
> (`~/.claude/skills/`) or plugin install will not resolve these paths —
> install per-project. Script state (`.impeccable/`, `live/`, `critique/`)
> is also written under the project root by design.

Run all three before touching design work or editing files:

1. Pull project context (PRODUCT.md / DESIGN.md) with the loader script.
2. Determine the register, then open its matching reference (brand.md or product.md).
3. **When the user invoked a sub-command (`craft`, `shape`, `audit`, ...), open that command's reference file as well.** Not optional: running `craft` without `craft.md` loaded drops the shape-and-confirm step the user is counting on.

Skip any of these and the result turns generic, blind to the project.

### 1. Context gathering

Two files, matched case-insensitively. By default the loader reads the project root, then falls back to `.agents/context/` and `docs/` when the root has neither. Point it elsewhere with `IMPECCABLE_CONTEXT_DIR=path/to/dir` (absolute, or relative to cwd).

- **PRODUCT.md**: required. Audience, brand, tone, anti-references, strategic principles.
- **DESIGN.md**: optional but strongly recommended. Color, typography, elevation, components.

Fetch both in a single call:

```bash
node .claude/skills/iblai-design/scripts/load-context.mjs
```

Read the whole JSON payload. Don't route it through `head`, `tail`, `grep`, or `jq`. Its `contextDir` field reports where the files resolved from.

Already have this output earlier in the session? Don't re-run it. Reload only after `/iblai-design teach` or `/iblai-design document` (both rewrite the files), or after the user hand-edits one.

`/iblai-design live` already warms context through `live.mjs`; once `live.mjs` has run, skip `load-context.mjs` for the rest of the session.

When PRODUCT.md is absent, empty, or still a placeholder (`[TODO]` markers, under 200 chars): run `/iblai-design teach` first, then pick the user's original task back up with the fresh context. If that task was `/iblai-design craft`, re-enter through `/iblai-design shape` before any implementation work.

If DESIGN.md is missing, don't nudge and then work blind. Resolve a design
system in this order (first match wins), nudge once per session
(*"Run `/iblai-design document` for a project-specific DESIGN.md"*), then proceed:

1. The project's own tokens (see detection table below).
2. The ibl.ai **BRAND.md** defaults.

### ibl.ai design defaults (BRAND.md fallback)

With no DESIGN.md present, first check whether the project already defines
its own visual language. **If it does, the project's tokens win** — never
paper over them with ibl.ai brand defaults.

| Signal | Where to look | What it means |
|--------|---------------|----------------|
| `components.json` with shadcn entries | repo root | shadcn/ui (often v0). Match its `style`, `baseColor`, `cssVariables`. |
| `components/ui/` populated | `components/ui/*.tsx` | shadcn primitives installed. Reuse them; don't add a parallel UI lib. |
| Custom CSS vars beyond shadcn defaults | `app/globals.css`, `styles/globals.css` | `--primary`, `--brand-*`, custom radius/shadow tokens define the palette. Bind to these, not ibl.ai hex. |
| `tailwind.config.*` extends colors/fonts | repo root | `theme.extend.colors/fontFamily` carry intent. Match them. |
| Tailwind v4 `@theme { }` block | `globals.css` | Same as above for Tailwind v4. |
| Custom font via `next/font` | `app/layout.tsx` | Don't replace it. Inherit it. |
| Existing app shell | `components/{navbar,sidebar,header,app-shell}.tsx` | Plug into it; don't add a second shell. |
| `BRAND.md` / `DESIGN.md` / `design-tokens.*` | repo root, `docs/`, `lib/` | The project documents its own language. Read it first. |

**If none of those signals are present**, the project has no design
system — adopt the ibl.ai
[BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
as the DESIGN.md for this session: its color palette (primary `#0058cc`,
brand gradient `linear-gradient(135deg, #00b0ef, #0058cc)`), system
sans-serif stack, spacing/radius/shadow scales, shadcn `new-york` +
`neutral` + Lucide component style, and the Apple-inspired layout
language. Give BRAND.md tokens the same authority a DESIGN.md would
carry — the shared design laws below still stack on top.

State what you resolved in one line before designing:

> Using ibl.ai BRAND.md defaults (no project design system detected).

or

> Detected shadcn-new-york + custom `--primary`. Binding to project tokens, not ibl.ai defaults.

### 2. Register

Each design task is one of two: **brand** (marketing, landing, campaign, long-form content, portfolio: the design IS the product) or **product** (app UI, admin, dashboard, tool: the design SERVES the product).

Settle this before designing. Precedence: (1) a cue in the task wording ("landing page" vs "dashboard"); (2) the surface in focus (the page, file, or route under work); (3) the `register` field in PRODUCT.md. First match wins.

When PRODUCT.md carries no `register` field (older files), infer it once from its "Users" and "Product Purpose" sections and cache that value for the session. Recommend `/iblai-design teach` so the field gets recorded explicitly.

Open the matching reference: [reference/brand.md](reference/brand.md) or [reference/product.md](reference/product.md). The shared design laws below hold for both.

## Shared design laws

These hold for every design, in both registers. Let implementation effort track the aesthetic: maximalism wants elaborate code, minimalism wants precision. Interpret with intent. Diverge between projects; never keep landing on the same choices. Claude is capable of extraordinary work here. Don't hold back.

### Color

- Work in OKLCH. Pull chroma down as lightness approaches 0 or 100; high chroma at the extremes reads garish.
- Never `#000` or `#fff`. Bias every neutral toward the brand hue (chroma 0.005–0.01 is plenty).
- Choose a **color strategy** before choosing colors. Four points on the commitment axis:
  - **Restrained**: tinted neutrals + one accent ≤10%. Product default; brand minimalism.
  - **Committed**: one saturated color owns 30–60% of the surface. Brand default for identity-led pages.
  - **Full palette**: 3–4 named roles, each placed on purpose. Brand campaigns; product data viz.
  - **Drenched**: the surface IS the color. Brand heroes and campaign pages.
- The "one accent ≤10%" cap is Restrained only. Committed / Full palette / Drenched blow past it on purpose. Don't reflexively flatten every design back to Restrained.

### Theme

Dark vs. light is never automatic. Not dark "because tools look cool dark." Not light "to play it safe."

Before deciding, write one sentence of physical scene: who uses this, where, under what ambient light, in what mood. If the sentence doesn't force the answer, it isn't concrete enough; add detail until it does.

"Observability dashboard" forces nothing. "SRE glancing at incident severity on a 27-inch monitor at 2am in a dim room" forces it. Reason from the sentence, not the category.

### Typography

- Keep body measure at 65–75ch.
- Build hierarchy from scale + weight contrast (≥1.25 ratio between steps). No flat scales.

### Layout

- Vary spacing for rhythm. Identical padding everywhere is monotony.
- Cards are the lazy default. Use them only when they're genuinely the best affordance. Nested cards are always wrong.
- Don't box everything in a container. Most things don't need one.

### Motion

- Never animate CSS layout properties.
- Ease out on exponential curves (ease-out-quart / quint / expo). No bounce, no elastic.

### Absolute bans

Match and refuse. About to write any of these? Rebuild the element with a different structure.

- **Side-stripe borders.** A `border-left` or `border-right` over 1px used as a colored accent on cards, list items, callouts, or alerts. Never deliberate. Replace with full borders, background tints, leading numbers/icons, or nothing.
- **Gradient text.** `background-clip: text` over a gradient background. Decoration, never signal. Use one solid color. Carry emphasis with weight or size.
- **Glassmorphism as default.** Decorative blur and glass cards. Rare and deliberate, or absent.
- **The hero-metric template.** Huge number, tiny label, supporting stats, gradient accent. The SaaS cliché.
- **Identical card grids.** Equal-size cards of icon + heading + text, repeated without end.
- **Modal as first thought.** A modal is usually the lazy route. Exhaust inline / progressive options first.

### Copy

- Every word pays rent. No restated headings, no intro that echoes the title.
- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses. The `--` substitute is out too.

### The AI slop test

If a viewer could glance at the interface and say "AI made that" with no doubt, it failed. Cross-register tells are the absolute bans above. Register-specific tells live in each reference.

**Category-reflex check.** Run it at two altitudes; the second catches what the first misses.

- **First-order:** if the theme + palette are guessable from the category alone ("observability → dark blue", "healthcare → white + teal", "finance → navy + gold", "crypto → neon on black"), that's the first training-data reflex. Rework the scene sentence and color strategy until the domain no longer gives the answer away.
- **Second-order:** if the aesthetic family is guessable from category-plus-anti-references ("AI workflow tool that's not SaaS-cream → editorial-typographic", "fintech that's not navy-and-gold → terminal-native dark mode"), that's the trap one tier down: the first reflex was dodged, the second wasn't. Rework until neither answer is obvious. The brand register's [reflex-reject aesthetic lanes](reference/brand.md) list catches the currently-saturated families.

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `craft [feature]` | Build | Shape first, then build a feature end to end | [reference/craft.md](reference/craft.md) |
| `shape [feature]` | Build | Plan UX and UI before any code | [reference/shape.md](reference/shape.md) |
| `teach` | Build | Establish PRODUCT.md and DESIGN.md context | [reference/teach.md](reference/teach.md) |
| `document` | Build | Derive DESIGN.md from existing project code | [reference/document.md](reference/document.md) |
| `extract [target]` | Build | Lift reusable tokens and components into the design system | [reference/extract.md](reference/extract.md) |
| `critique [target]` | Evaluate | UX review with heuristic scoring | [reference/critique.md](reference/critique.md) |
| `audit [target]` | Evaluate | Technical quality checks: a11y, perf, responsive | [reference/audit.md](reference/audit.md) |
| `polish [target]` | Refine | Last quality pass before shipping | [reference/polish.md](reference/polish.md) |
| `bolder [target]` | Refine | Amplify timid or bland designs | [reference/bolder.md](reference/bolder.md) |
| `quieter [target]` | Refine | Calm aggressive or overstimulating designs | [reference/quieter.md](reference/quieter.md) |
| `distill [target]` | Refine | Strip to essentials, cut complexity | [reference/distill.md](reference/distill.md) |
| `harden [target]` | Refine | Production-ready: error states, i18n, edge cases | [reference/harden.md](reference/harden.md) |
| `onboard [target]` | Refine | Design first-run flows, empty states, and activation | [reference/onboard.md](reference/onboard.md) |
| `animate [target]` | Enhance | Add purposeful motion and micro-interactions | [reference/animate.md](reference/animate.md) |
| `colorize [target]` | Enhance | Inject strategic color into monochromatic UIs | [reference/colorize.md](reference/colorize.md) |
| `typeset [target]` | Enhance | Sharpen typographic hierarchy and font choices | [reference/typeset.md](reference/typeset.md) |
| `layout [target]` | Enhance | Repair spacing, rhythm, and visual hierarchy | [reference/layout.md](reference/layout.md) |
| `delight [target]` | Enhance | Add personality and memorable detail | [reference/delight.md](reference/delight.md) |
| `overdrive [target]` | Enhance | Push well past conventional limits | [reference/overdrive.md](reference/overdrive.md) |
| `clarify [target]` | Fix | Tighten UX copy, labels, and error messages | [reference/clarify.md](reference/clarify.md) |
| `adapt [target]` | Fix | Adapt across devices and screen sizes | [reference/adapt.md](reference/adapt.md) |
| `optimize [target]` | Fix | Diagnose and resolve UI performance issues | [reference/optimize.md](reference/optimize.md) |
| `live` | Iterate | Visual variant mode: select elements in the browser, generate alternatives | [reference/live.md](reference/live.md) |

Two management commands round it out: `pin <command>` and `unpin <command>`, covered below.

### Routing rules

1. **No argument**: present the table above as the command menu, grouped by category, and ask what they'd like to do.
2. **First word matches a command**: open its reference file and follow it. Everything after the command name is the target.
3. **First word matches nothing**: treat it as a general design request. Apply setup, the shared design laws, and the loaded register reference, with the full argument as context.

Setup (context gathering, register) is already done by this point; sub-commands don't re-invoke `/iblai-design`.

When the first word is `craft`, setup still runs first, but [reference/craft.md](reference/craft.md) drives the rest of the flow. If setup triggers `teach` as a blocker, finish teach, refresh context, then resume the original command and target.

## Pin / Unpin

**Pin** registers a standalone shortcut so `/<command>` runs `/iblai-design <command>` directly. **Unpin** removes it. The script writes into every harness directory present in the project.

```bash
node .claude/skills/iblai-design/scripts/pin.mjs <pin|unpin> <command>
```

`<command>` is any entry from the table above. Report the script's result tersely: confirm the new shortcut on success, relay stderr verbatim on error.
