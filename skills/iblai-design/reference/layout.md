Space is design's most neglected lever. Pinpoint the layout's real failing (uniform spacing, faint hierarchy, repeated identical card grids, the default centered stack) and repair the structure rather than the surface.

---

## Register

Brand: asymmetric compositions, fluid spacing with `clamp()`, deliberate grid-breaking to draw emphasis. Rhythm comes from contrast: tight clusters set against generous gaps.

Product: predictable grids, uniform densities, familiar navigation conventions. Responsive behavior is structural (collapse sidebar, responsive table) rather than fluid typography. Here, consistency itself is the affordance.

---

## Assess Current Layout

Diagnose where the existing spatial design falls short:

1. **Spacing**:
   - Is spacing consistent or arbitrary? (Random padding/margin values)
   - Is all spacing the same? (Equal padding everywhere = no rhythm)
   - Are related elements grouped tightly, with generous space between groups?

2. **Visual hierarchy**:
   - Apply the squint test: blur your (metaphorical) eyes. Can you still identify the most important element, second most important, and clear groupings?
   - Is hierarchy achieved effectively? (Space and weight alone can be enough; is the current approach working?)
   - Does whitespace guide the eye to what matters?

3. **Grid & structure**:
   - Is there a clear underlying structure, or does the layout feel random?
   - Are identical card grids used everywhere? (Icon + heading + text, repeated endlessly)
   - Is everything centered? (Left-aligned with asymmetric layouts feels more designed, but not a hard and fast rule)

4. **Rhythm & variety**:
   - Does the layout have visual rhythm? (Alternating tight/generous spacing)
   - Is every section structured the same way? (Monotonous repetition)
   - Are there intentional moments of surprise or emphasis?

5. **Density**:
   - Is the layout too cramped? (Not enough breathing room)
   - Is the layout too sparse? (Excessive whitespace without purpose)
   - Does density match the content type? (Data-dense UIs need tighter spacing; marketing pages need more air)

**CRITICAL**: When colors and fonts check out but an interface still feels "off," the layout is frequently the underlying culprit. Treat space as a design material and deploy it deliberately.

## Plan Layout Improvements

Refer to the [spatial design reference](spatial-design.md) for in-depth guidance on grids, rhythm, and container queries.

Build a methodical plan:

- **Spacing system**: Adopt a consistent scale (a framework's built-in scale like Tailwind's, rem-based tokens, or a custom system). Consistency matters more than the exact values.
- **Hierarchy strategy**: How will space communicate importance?
- **Layout approach**: What structure fits the content? Flex for 1D, Grid for 2D, named areas for complex page layouts.
- **Rhythm**: Where should spacing be tight vs generous?

## Improve Layout Systematically

### Establish a Spacing System

- Adopt a consistent spacing scale (framework scales like Tailwind, rem-based tokens, or a custom scale are all fine). The key is that values are drawn from a defined set rather than picked arbitrarily.
- Name tokens semantically if using custom properties: `--space-xs` through `--space-xl`, not `--spacing-8`
- Use `gap` for sibling spacing instead of margins; eliminates margin collapse hacks
- Apply `clamp()` for fluid spacing that breathes on larger screens

### Create Visual Rhythm

- **Tight grouping** for related elements (8-12px between siblings)
- **Generous separation** between distinct sections (48-96px)
- **Varied spacing** within sections (not every row needs the same gap)
- **Asymmetric compositions**: depart from the expected centered-content pattern where it serves the design

### Choose the Right Layout Tool

- **Use Flexbox for 1D layouts**: Rows of items, nav bars, button groups, card contents, most component internals. Flex is the simpler, more fitting choice for the bulk of layout work.
- **Use Grid for 2D layouts**: Page-level structure, dashboards, data-dense interfaces, anything where rows AND columns need coordinated control.
- **Don't default to Grid** when Flexbox with `flex-wrap` would be simpler and more flexible.
- Use `repeat(auto-fit, minmax(280px, 1fr))` for responsive grids without breakpoints.
- Use named grid areas (`grid-template-areas`) for complex page layouts; redefine at breakpoints.

### Break Card Grid Monotony

- Don't reach for card grids by default; spacing and alignment group content visually on their own
- Reserve cards for content that is genuinely separate and actionable. Never nest cards inside cards
- Break up repetition by varying card sizes, spanning columns, or interleaving cards with non-card content

### Strengthen Visual Hierarchy

- Use as few dimensions as the hierarchy needs to be clear. Space by itself can suffice; generous whitespace around an element pulls the eye toward it. Many of the most refined designs build rhythm from space and weight alone. Reach for color or size contrast only when the simpler approaches fall short.
- Mind the reading flow: in LTR languages the eye scans naturally from top-left to bottom-right, yet where the primary action goes depends on context (e.g., bottom-right in dialogs, top in navigation).
- Create clear content groupings through proximity and separation.

### Manage Depth & Elevation

- Create a semantic z-index scale (dropdown → sticky → modal-backdrop → modal → toast → tooltip)
- Build a consistent shadow scale (sm → md → lg → xl); shadows should be subtle
- Use elevation to reinforce hierarchy, not as decoration

### Optical Adjustments

- When an icon reads as off-center even though it is geometrically centered, nudge it. Do so only when you're sure it genuinely looks wrong. Don't make speculative adjustments.

**NEVER**:
- Use arbitrary spacing values outside your scale
- Make all spacing equal (variety creates hierarchy)
- Wrap everything in cards (not everything needs a container)
- Nest cards inside cards (use spacing and dividers for hierarchy within)
- Use identical card grids everywhere (icon + heading + text, repeated)
- Center everything (left-aligned with asymmetry feels more designed)
- Default to the hero metric layout (big number, small label, stats, gradient) as a template. A prominent metric is acceptable when it presents real user data, but it must show actual data, not decorative numbers.
- Default to CSS Grid when Flexbox would be simpler; use the simplest tool for the job
- Use arbitrary z-index values (999, 9999); build a semantic scale

## Verify Layout Improvements

- **Squint test**: Can you identify primary, secondary, and groupings with blurred vision?
- **Rhythm**: Does the page have a satisfying beat of tight and generous spacing?
- **Hierarchy**: Is the most important content obvious within 2 seconds?
- **Breathing room**: Does the layout feel comfortable, not cramped or wasteful?
- **Consistency**: Is the spacing system applied uniformly?
- **Responsiveness**: Does the layout adapt gracefully across screen sizes?

Once the rhythm and hierarchy come together, pass it to `/iblai-design polish` for the final pass.

## Live-mode signature params

Every variant MUST declare a `density` param. Route all spacing tokens in the variant's scoped CSS through `calc(var(--p-density, 1) * <base>)`: paddings, gaps, column widths. Users slide from airy to packed and watch the layout re-breathe without any regeneration.

```json
{"id":"density","kind":"range","min":0.6,"max":1.4,"step":0.05,"default":1,"label":"Density"}
```

When a variant's topology truly shifts (stacked vs. side-by-side, grid vs. bento), use a `steps` param whose scoped CSS branches via `:scope[data-p-structure="X"]`. One structure param plus one density param is a strong combination; resist adding a third.

```json
{"id":"structure","kind":"steps","default":"grid","label":"Structure","options":[
  {"value":"stacked","label":"Stacked"},
  {"value":"grid","label":"Grid"},
  {"value":"bento","label":"Bento"}
]}
```

See `reference/live.md` for the full params contract.
