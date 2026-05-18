> **Additional context needed**: quality bar (MVP vs flagship).

Make one careful, deliberate sweep to catch every small detail that separates good work from great work. That gap is the difference between merely shipped and truly polished.

Detector and automated QA output only point to defects. A passing script never proves the design is solid; collect browser evidence and walk the actual interaction path yourself.

## Design System Discovery

Bringing the feature into line with the design system is **not optional**. Polishing without that alignment just dresses up drift, and it leaves the next person worse off. Do discovery before any other polish work begins.

1. **Find the design system**: Hunt for design system docs, component libraries, style guides, or token definitions. Learn the core patterns: design principles, target audience, color tokens, spacing scale, typography styles, component API, motion conventions.
2. **Note the conventions**: How do shared components get imported? Which spacing scale applies? Which colors are token-driven versus hard-coded? Which motion and interaction patterns are already established? What flow shapes do comparable actions take (modal vs full-page, inline vs route, save-on-blur vs explicit submit)?
3. **Identify drift, then name the root cause**: For each deviation, label it a **missing token** (the value belongs in the system but isn't there), a **one-off implementation** (a shared component exists but went unused), or a **conceptual misalignment** (the feature's flow, IA, or hierarchy doesn't match its neighbors). Each category calls for a different fix: patch the value, switch to the shared component, or rework the flow. Treating the symptom without identifying the cause is exactly how drift compounds.

When a design system is present, polish **must** align the feature to it. With no system, polish against the conventions already visible in the codebase. **When anything about the system is unclear, ask. Never guess at design system principles.**

## Pre-Polish Assessment

Get a read on the current state and the goals before you touch anything:

1. **Review completeness**:
   - Is it functionally complete?
   - Are there known issues to preserve (mark with TODOs)?
   - What's the quality bar? (MVP vs flagship feature?)
   - When does it ship? (How much time for polish?)

2. **Think experience-first**: Who genuinely uses this, and what's the best possible experience for them? Effective design wins over decorative polish; a feature that looks beautiful yet fights the user's flow isn't polished. Walk their path from their point of view before you open DevTools.

3. **Identify polish areas**:
   - Visual inconsistencies
   - Spacing and alignment issues
   - Interaction state gaps
   - Copy inconsistencies
   - Edge cases and error states
   - Loading and transition smoothness
   - Information architecture and flow drift (does this feature reveal complexity the way neighboring features do?)

4. **Pull in any prior critique** (optional signal): When `/iblai-design critique` has already run against the same target, its priority issues are a helpful starting point for what to tackle first. Resolve the target to a file path or URL, then:
   ```bash
   slug=$(node .claude/skills/iblai-design/scripts/critique-storage.mjs slug "<resolved>")
   node .claude/skills/iblai-design/scripts/critique-storage.mjs latest "$slug"
   ```
   Exit 0 with body = found; fold the P0/P1 items into your polish list and mention the snapshot path so the user sees what you read. Exit 2 = no snapshot, continue without it. The critique is just one input among several. Do your own pass regardless.

5. **Triage cosmetic vs functional**: Sort each issue as **cosmetic** (looks off but doesn't get in the user's way) or **functional** (breaks, blocks, or confuses the experience). When polish time runs short, functional issues go first; cosmetic ones can follow up later. Keep quality even; never perfect one corner while another stays rough.

**CRITICAL**: Polish is the last step, not the first. Don't polish work that isn't functionally complete.

## Polish Systematically

Work through these dimensions methodically:

### Visual Alignment & Spacing

- **Pixel-perfect alignment**: Everything lines up to grid
- **Consistent spacing**: All gaps use spacing scale (no random 13px gaps)
- **Optical alignment**: Adjust for visual weight (icons may need offset for optical centering)
- **Responsive consistency**: Spacing and alignment work at all breakpoints
- **Grid adherence**: Elements snap to baseline grid

**Check**:
- Enable grid overlay and verify alignment
- Check spacing with browser inspector
- Test at multiple viewport sizes
- Look for elements that "feel" off

### Information Architecture & Flow

Visual polish applied to a misshapen flow is wasted effort. Match the *shape* of the experience to the system, not just its surface.

- **Progressive disclosure**: Match how much gets revealed and when, relative to neighboring features. A settings page showing 40 fields when the rest of the app reveals 5 at a time is drift, even when every field is styled perfectly.
- **Established user flows**: Multi-step actions take the same shape as comparable flows elsewhere: modal vs full-page, inline edit vs separate route, save-on-blur vs explicit submit, optimistic vs pessimistic updates.
- **Hierarchy & complexity**: Equal conceptual weight earns equal visual weight throughout. Primary actions shouldn't drop to tertiary in one corner of the product, and tertiary actions shouldn't shout.
- **Empty, loading, and arrival transitions**: How content arrives, updates, and departs matches how it does in adjacent features.
- **Naming and mental model**: The feature uses the same nouns and verbs as the rest of the system. A "Workspace" here shouldn't become a "Project" three screens away.

### Typography Refinement

- **Hierarchy consistency**: Same elements use same sizes/weights throughout
- **Line length**: 45-75 characters for body text
- **Line height**: Appropriate for font size and context
- **Widows & orphans**: No single words on last line
- **Hyphenation**: Appropriate for language and column width
- **Kerning**: Adjust letter spacing where needed (especially headlines)
- **Font loading**: No FOUT/FOIT flashes

### Color & Contrast

- **Contrast ratios**: All text meets WCAG standards
- **Consistent token usage**: No hard-coded colors, all use design tokens
- **Theme consistency**: Works in all theme variants
- **Color meaning**: Same colors mean same things throughout
- **Accessible focus**: Focus indicators visible with sufficient contrast
- **Tinted neutrals**: No pure gray or pure black; add subtle color tint (0.01 chroma)
- **Gray on color**: Never put gray text on colored backgrounds; use a shade of that color or transparency

### Interaction States

Every interactive element needs all states:

- **Default**: Resting state
- **Hover**: Subtle feedback (color, scale, shadow)
- **Focus**: Keyboard focus indicator (never remove without replacement)
- **Active**: Click/tap feedback
- **Disabled**: Clearly non-interactive
- **Loading**: Async action feedback
- **Error**: Validation or error state
- **Success**: Successful completion

**Missing states create confusion and broken experiences**.

### Micro-interactions & Transitions

- **Smooth transitions**: All state changes animated appropriately (150-300ms)
- **Consistent easing**: Use ease-out-quart/quint/expo for natural deceleration. Never bounce or elastic; they feel dated.
- **No jank**: Smooth animations; use atmospheric blur/filter/mask/shadow effects when they add polish, but bound expensive paint areas and avoid casual layout-property animation
- **Appropriate motion**: Motion serves purpose, not decoration
- **Reduced motion**: Respects `prefers-reduced-motion`

### Content & Copy

- **Consistent terminology**: Same things called same names throughout
- **Consistent capitalization**: Title Case vs Sentence case applied consistently
- **Grammar & spelling**: No typos
- **Appropriate length**: Not too wordy, not too terse
- **Punctuation consistency**: Periods on sentences, not on labels (unless all labels have them)

### Icons & Images

- **Consistent style**: All icons from same family or matching style
- **Appropriate sizing**: Icons sized consistently for context
- **Proper alignment**: Icons align with adjacent text optically
- **Alt text**: All images have descriptive alt text
- **Loading states**: Images don't cause layout shift, proper aspect ratios
- **Retina support**: 2x assets for high-DPI screens

### Forms & Inputs

- **Label consistency**: All inputs properly labeled
- **Required indicators**: Clear and consistent
- **Error messages**: Helpful and consistent
- **Tab order**: Logical keyboard navigation
- **Auto-focus**: Appropriate (don't overuse)
- **Validation timing**: Consistent (on blur vs on submit)

### Edge Cases & Error States

- **Loading states**: All async actions have loading feedback
- **Empty states**: Helpful empty states, not just blank space
- **Error states**: Clear error messages with recovery paths
- **Success states**: Confirmation of successful actions
- **Long content**: Handles very long names, descriptions, etc.
- **No content**: Handles missing data gracefully
- **Offline**: Appropriate offline handling (if applicable)

### Responsiveness

- **All breakpoints**: Test mobile, tablet, desktop
- **Touch targets**: 44x44px minimum on touch devices
- **Readable text**: No text smaller than 14px on mobile
- **No horizontal scroll**: Content fits viewport
- **Appropriate reflow**: Content adapts logically

### Performance

- **Fast initial load**: Optimize critical path
- **No layout shift**: Elements don't jump after load (CLS)
- **Smooth interactions**: No lag or jank
- **Optimized images**: Appropriate formats and sizes
- **Lazy loading**: Off-screen content loads lazily

### Code Quality

- **Remove console logs**: No debug logging in production
- **Remove commented code**: Clean up dead code
- **Remove unused imports**: Clean up unused dependencies
- **Consistent naming**: Variables and functions follow conventions
- **Type safety**: No TypeScript `any` or ignored errors
- **Accessibility**: Proper ARIA labels and semantic HTML

## Polish Checklist

Go through systematically:

- [ ] Aligned to the design system (drift named and resolved by root cause)
- [ ] Information architecture and flow shape match neighboring features
- [ ] Visual alignment perfect at all breakpoints
- [ ] Spacing uses design tokens consistently
- [ ] Typography hierarchy consistent
- [ ] All interactive states implemented
- [ ] All transitions smooth (60fps)
- [ ] Copy is consistent and polished
- [ ] Icons are consistent and properly sized
- [ ] All forms properly labeled and validated
- [ ] Error states are helpful
- [ ] Loading states are clear
- [ ] Empty states are welcoming
- [ ] Touch targets are 44x44px minimum
- [ ] Contrast ratios meet WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] No console errors or warnings
- [ ] No layout shift on load
- [ ] Works in all supported browsers
- [ ] Respects reduced motion preference
- [ ] Code is clean (no TODOs, console.logs, commented code)

**IMPORTANT**: Polish is all about details. Zoom in. Squint at it. Use it yourself. The little things add up.

Obsess over the details. Zoom in until the alignment is right and the spacing reads as intentional. Then ship.

**NEVER**:
- Polish before it's functionally complete
- Polish without aligning to the design system; that's decoration on drift
- Guess at design system principles instead of asking when something is ambiguous
- Spend hours on polish if it ships in 30 minutes (triage)
- Introduce bugs while polishing (test thoroughly)
- Ignore systematic issues (if spacing is off everywhere, fix the system, not just one screen)
- Perfect one thing while leaving others rough (consistent quality level)
- Create new one-off components when design system equivalents exist
- Hard-code values that should use design tokens
- Introduce new patterns or flows that diverge from established ones

## Final Verification

Before marking as done:

- **Use it yourself**: Actually interact with the feature.
- **Test on real devices**: Not just browser DevTools.
- **Ask someone else to review**: Fresh eyes catch things.
- **Compare to design**: Match intended design.
- **Check all states**: Don't just test happy path.
- **Treat automation carefully**: Run detector or QA commands when they're available and relevant, fix their defects, but never cite a clean result as proof the work is polished.

## Clean Up

Once polishing is done, secure code quality:

- **Replace custom implementations**: When the design system already offers a component you reimplemented, switch over to the shared version.
- **Remove orphaned code**: Delete styles, components, or files that polish made obsolete.
- **Consolidate tokens**: If you added new values, check whether they belong as tokens.
- **Verify DRYness**: Find any duplication that crept in during polishing and consolidate it.
