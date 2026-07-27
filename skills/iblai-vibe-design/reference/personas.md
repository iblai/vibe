# Persona-Based Design Testing

Evaluate the interface from the viewpoint of 5 separate user archetypes. Each archetype surfaces distinct failure modes that one "design director" lens would overlook.

**How to use**: Pick the 2–3 personas that best fit the interface under critique. Run through the primary user action while inhabiting each persona. Call out concrete red flags rather than generic worries.

---

## 1. Impatient Power User: "Alex"


**Profile**: Seasoned with comparable tools. Demands speed, dislikes being coddled. Will discover shortcuts or move on.

**Behaviors**:
- Bypasses every bit of onboarding and instruction
- Hunts for keyboard shortcuts right away
- Attempts bulk selection, batch edits, and automation
- Becomes annoyed by mandatory steps that seem pointless
- Leaves the moment something feels sluggish or condescending

**Test Questions**:
- Can Alex finish the core task in less than 60 seconds?
- Do common actions have keyboard shortcuts?
- Is it possible to skip onboarding completely?
- Can modals be dismissed via the keyboard (Esc)?
- Does a "power user" route exist (shortcuts, bulk actions)?

**Red Flags** (report these specifically):
- Mandatory tutorials or onboarding that can't be skipped
- Primary actions lacking keyboard navigation
- Slow animations with no skip option
- One-at-a-time flows where batching would be the natural fit
- Extra confirmation steps for actions that carry little risk

---

## 2. Confused First-Timer: "Jordan"

**Profile**: Has never touched this kind of product. Requires guidance at each step. Will give up instead of working it out.

**Behaviors**:
- Reads every instruction with care
- Pauses before clicking anything unfamiliar
- Constantly seeks help or support
- Misreads jargon and abbreviations
- Interprets every label in the most literal way

**Test Questions**:
- Is the first action obvious within 5 seconds?
- Does every icon carry a text label?
- Is contextual help present at decision points?
- Does the terminology presume prior knowledge?
- Is a clear "back" or "undo" available at each step?

**Red Flags** (report these specifically):
- Icon-only navigation lacking labels
- Technical jargon left unexplained
- No visible help option or guidance
- Unclear next steps once an action is done
- No confirmation that an action worked

---

## 3. Accessibility-Dependent User: "Sam"

**Profile**: Relies on a screen reader (VoiceOver/NVDA) and keyboard-only navigation. May have low vision, a motor impairment, or cognitive differences.

**Behaviors**:
- Moves through the interface linearly via Tab
- Depends on ARIA labels and heading structure
- Cannot perceive hover states or visual-only cues
- Requires sufficient color contrast (4.5:1 minimum)
- May zoom the browser as high as 200%

**Test Questions**:
- Can the whole primary flow be done with the keyboard alone?
- Are all interactive elements focusable, with visible focus indicators?
- Do images carry meaningful alt text?
- Is color contrast WCAG AA compliant (4.5:1 for text)?
- Does the screen reader announce state changes (loading, success, errors)?

**Red Flags** (report these specifically):
- Click-only interactions with no keyboard equivalent
- Focus indicators that are missing or invisible
- Meaning carried by color alone (red = error, green = success)
- Form fields or buttons with no labels
- Time-limited actions offering no extension
- Custom components that disrupt screen reader flow

---

## 4. Deliberate Stress Tester: "Riley"

**Profile**: A methodical user who drives interfaces past the happy path. Probes edge cases, feeds in unexpected inputs, and searches for gaps in the experience.

**Behaviors**:
- Deliberately exercises edge cases (empty states, long strings, special characters)
- Submits forms with unexpected data (emoji, RTL text, very long values)
- Attempts to break flows by going backward, refreshing mid-flow, or opening multiple tabs
- Hunts for mismatches between what the UI promises and what actually occurs
- Records problems methodically

**Test Questions**:
- What occurs at the extremes (0 items, 1000 items, very long text)?
- Do error states recover cleanly or leave the UI broken?
- What happens on a mid-workflow refresh? Is state kept?
- Are there features that seem to function but yield broken outcomes?
- How does the UI cope with unexpected input (emoji, special chars, paste from Excel)?

**Red Flags** (report these specifically):
- Features that look like they work but silently fail or return wrong results
- Error handling that leaks technical details or leaves the UI broken
- Empty states offering nothing useful ("No results" with no guidance)
- Flows that discard user data on refresh or navigation
- Inconsistent behavior across similar interactions in different parts of the UI

---

## 5. Distracted Mobile User: "Casey"

**Profile**: On a phone, one-handed, while moving. Interrupted often. Possibly on a slow connection.

**Behaviors**:
- Uses only the thumb; favors actions at the bottom of the screen
- Gets interrupted mid-flow and comes back later
- Switches between apps often
- Has a short attention span and little patience
- Types as little as possible, preferring taps and selections

**Test Questions**:
- Are primary actions within the thumb zone (lower half of the screen)?
- Is state retained when the user leaves and returns?
- Does it function on slow connections (3G)?
- Can forms leverage autocomplete and smart defaults?
- Are touch targets at least 44×44pt?

**Red Flags** (report these specifically):
- Key actions placed at the top of the screen (out of thumb reach)
- No state persistence; progress lost on tab switch or interruption
- Large text inputs demanded where a selection would suffice
- Heavy assets loaded on every page (no lazy loading)
- Tiny tap targets or targets packed too closely together

---

## Selecting Personas

Pick personas based on the kind of interface:

| Interface Type | Primary Personas | Why |
|---------------|-----------------|-----|
| Landing page / marketing | Jordan, Riley, Casey | First impressions, trust, mobile |
| Dashboard / admin | Alex, Sam | Power users, accessibility |
| E-commerce / checkout | Casey, Riley, Jordan | Mobile, edge cases, clarity |
| Onboarding flow | Jordan, Casey | Confusion, interruption |
| Data-heavy / analytics | Alex, Sam | Efficiency, keyboard nav |
| Form-heavy / wizard | Jordan, Sam, Casey | Clarity, accessibility, mobile |

---

## Project-Specific Personas

If `CLAUDE.md` includes a `## Design Context` section (created by `impeccable teach`), build 1–2 extra personas from the audience and brand details:

1. Read the description of the target audience
2. Pinpoint the main user archetype not already covered by the 5 predefined personas
3. Build a persona using this template:

```
### [Role]: "[Name]"

**Profile**: [2-3 key characteristics derived from Design Context]

**Behaviors**: [3-4 specific behaviors based on the described audience]

**Red Flags**: [3-4 things that would alienate this specific user type]
```

Create project-specific personas only when genuine Design Context data exists. Don't fabricate audience details; fall back to the 5 predefined personas whenever no context is present.
