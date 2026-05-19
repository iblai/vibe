# Interaction Design

## The Eight Interactive States

Every interactive element needs these states designed:

| State | When | Visual Treatment |
|-------|------|------------------|
| **Default** | At rest | Base styling |
| **Hover** | Pointer over (not touch) | Subtle lift, color shift |
| **Focus** | Keyboard/programmatic focus | Visible ring (see below) |
| **Active** | Being pressed | Pressed in, darker |
| **Disabled** | Not interactive | Reduced opacity, no pointer |
| **Loading** | Processing | Spinner, skeleton |
| **Error** | Invalid state | Red border, icon, message |
| **Success** | Completed | Green check, confirmation |

**The common miss**: Designing hover but not focus, or the reverse. They aren't the same. Keyboard users never see hover states.

## Focus Rings: Do Them Right

**Never `outline: none` without replacement.** That's an accessibility violation. Instead, lean on `:focus-visible` so the focus shows only for keyboard users:

```css
/* Hide focus ring for mouse/touch */
button:focus {
  outline: none;
}

/* Show focus ring for keyboard */
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

**Focus ring design**:
- High contrast (3:1 minimum against adjacent colors)
- 2-3px thick
- Offset from element (not inside it)
- Consistent across all interactive elements

## Form Design: The Non-Obvious

**Placeholders aren't labels.** They vanish once the user types. Always include visible `<label>` elements. **Validate on blur**, not on each keystroke (exception: password strength). Position errors **below** fields with `aria-describedby` linking them.

## Loading States

**Optimistic updates**: Show success right away, roll back on failure. Use this for low-stakes actions (likes, follows), not payments or destructive actions. **Skeleton screens > spinners**: they preview the content's shape and feel quicker than generic spinners.

## Modals: The Inert Approach

Trapping focus in modals once needed elaborate JavaScript. Now reach for the `inert` attribute:

```html
<!-- When modal is open -->
<main inert>
  <!-- Content behind modal can't be focused or clicked -->
</main>
<dialog open>
  <h2>Modal Title</h2>
  <!-- Focus stays inside modal -->
</dialog>
```

Or use the native `<dialog>` element:

```javascript
const dialog = document.querySelector('dialog');
dialog.showModal();  // Opens with focus trap, closes on Escape
```

## The Popover API

For tooltips, dropdowns, and non-modal overlays, reach for native popovers:

```html
<button popovertarget="menu">Open menu</button>
<div id="menu" popover>
  <button>Option 1</button>
  <button>Option 2</button>
</div>
```

**Benefits**: Light-dismiss (clicking outside closes it), proper stacking, no z-index wars, accessible by default.

## Dropdown & Overlay Positioning

A dropdown rendered with `position: absolute` inside a container set to `overflow: hidden` or `overflow: auto` gets clipped. This is by far the most common dropdown bug in generated code.

### CSS Anchor Positioning

The modern fix uses the CSS Anchor Positioning API to tie an overlay to its trigger without any JavaScript:

```css
.trigger {
  anchor-name: --menu-trigger;
}

.dropdown {
  position: fixed;
  position-anchor: --menu-trigger;
  position-area: block-end span-inline-end;
  margin-top: 4px;
}

/* Flip above if no room below */
@position-try --flip-above {
  position-area: block-start span-inline-end;
  margin-bottom: 4px;
}
```

Since the dropdown uses `position: fixed`, it escapes any `overflow` clipping on ancestor elements. The `@position-try` block deals with viewport edges automatically. **Browser support**: Chrome 125+, Edge 125+. Not in Firefox or Safari yet - use a fallback for those browsers.

### Popover + Anchor Combo

Pairing the Popover API with anchor positioning hands you stacking, light-dismiss, accessibility, and correct positioning in a single pattern:

```html
<button popovertarget="menu" class="trigger">Open</button>
<div id="menu" popover class="dropdown">
  <button>Option 1</button>
  <button>Option 2</button>
</div>
```

The `popover` attribute puts the element in the **top layer**, which sits above all other content no matter the z-index or overflow. No portal needed.

### Portal / Teleport Pattern

In component frameworks, render the dropdown at the document root and position it via JavaScript:

- **React**: `createPortal(dropdown, document.body)`
- **Vue**: `<Teleport to="body">`
- **Svelte**: Use a portal library or mount to `document.body`

Compute the position from the trigger's `getBoundingClientRect()`, then apply `position: fixed` with `top` and `left` values. Recalculate on scroll and resize.

### Fixed Positioning Fallback

For browsers lacking anchor positioning support, `position: fixed` with manual coordinates sidesteps overflow clipping:

```css
.dropdown {
  position: fixed;
  /* top/left set via JS from trigger's getBoundingClientRect() */
}
```

Check viewport boundaries before rendering. If the dropdown would spill past the bottom edge, flip it above the trigger. If it would spill past the right edge, align it to the trigger's right side instead.

### Anti-Patterns

- **`position: absolute` inside `overflow: hidden`** - The dropdown gets clipped. Use `position: fixed` or the top layer instead.
- **Arbitrary z-index values** like `z-index: 9999` - Use a semantic z-index scale: `dropdown (100) -> sticky (200) -> modal-backdrop (300) -> modal (400) -> toast (500) -> tooltip (600)`.
- **Rendering dropdown markup inline** with no escape hatch from the parent's stacking context. Use `popover` (top layer), a portal, or `position: fixed`.

## Destructive Actions: Undo > Confirm

**Undo beats confirmation dialogs.** Users dismiss confirmations on autopilot. Remove from the UI right away, surface an undo toast, and actually delete once the toast expires. Reserve confirmation for genuinely irreversible actions (account deletion), high-cost actions, or batch operations.

## Keyboard Navigation Patterns

### Roving Tabindex

For component groups (tabs, menu items, radio groups), one item is tabbable; arrow keys move within:

```html
<div role="tablist">
  <button role="tab" tabindex="0">Tab 1</button>
  <button role="tab" tabindex="-1">Tab 2</button>
  <button role="tab" tabindex="-1">Tab 3</button>
</div>
```

Arrow keys shift `tabindex="0"` among the items. Tab jumps to the next component entirely.

### Skip Links

Offer skip links (`<a href="#main-content">Skip to main content</a>`) so keyboard users can leap past navigation. Hide off-screen, reveal on focus.

## Gesture Discoverability

Swipe-to-delete and similar gestures are invisible. Hint that they exist:

- **Partially reveal**: Show delete button peeking from edge
- **Onboarding**: Coach marks on first use
- **Alternative**: Always provide a visible fallback (menu with "Delete")

Don't make gestures the only way to carry out actions.

---

**Avoid**: Removing focus indicators without alternatives. Using placeholder text as labels. Touch targets <44x44px. Generic error messages. Custom controls without ARIA/keyboard support.
