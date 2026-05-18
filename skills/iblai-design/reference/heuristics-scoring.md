# Heuristics Scoring Guide

Rate each of Nielsen's 10 Usability Heuristics on a 0–4 scale. Stay honest: a 4 means truly excellent, not merely "good enough."

## Nielsen's 10 Heuristics

### 1. Visibility of System Status

Keep users informed of what's going on through feedback that is timely and fitting.

**Check for**:
- Loading indicators during async operations
- Confirmation of user actions (save, submit, delete)
- Progress indicators for multi-step processes
- Current location in navigation (breadcrumbs, active states)
- Form validation feedback (inline, not just on submit)

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | No feedback; the user is left guessing what happened |
| 1 | Feedback is rare; most actions trigger no visible response |
| 2 | Partial; some states communicated, major gaps remain |
| 3 | Good; most operations give clear feedback, with minor gaps |
| 4 | Excellent; every action confirms and progress is always visible |

### 2. Match Between System and Real World

Talk in the user's language. Honor real-world conventions. Present information in a natural, logical order.

**Check for**:
- Familiar terminology (no unexplained jargon)
- Logical information order matching user expectations
- Recognizable icons and metaphors
- Domain-appropriate language for the target audience
- Natural reading flow (left-to-right, top-to-bottom priority)

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Pure tech jargon, foreign to users |
| 1 | Largely confusing; navigating it demands domain expertise |
| 2 | Mixed; some plain language, with jargon leaking through |
| 3 | Largely natural; an occasional term needs context |
| 4 | Speaks the user's language fluently throughout |

### 3. User Control and Freedom

Users need an obvious "emergency exit" out of unwanted states without a drawn-out dialogue.

**Check for**:
- Undo/redo functionality
- Cancel buttons on forms and modals
- Clear navigation back to safety (home, previous)
- Easy way to clear filters, search, selections
- Escape from long or multi-step processes

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Users get trapped; no exit short of refreshing |
| 1 | Exits are difficult; escape requires obscure paths |
| 2 | Some exits; main flows have escape, edge cases don't |
| 3 | Good control; users can exit and undo most actions |
| 4 | Full control; undo, cancel, back, and escape everywhere |

### 4. Consistency and Standards

Users shouldn't have to wonder whether different words, situations, or actions mean the same thing.

**Check for**:
- Consistent terminology throughout the interface
- Same actions produce same results everywhere
- Platform conventions followed (standard UI patterns)
- Visual consistency (colors, typography, spacing, components)
- Consistent interaction patterns (same gesture = same behavior)

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Inconsistent throughout; feels like different products stitched together |
| 1 | Many inconsistencies; similar things look or behave differently |
| 2 | Partly consistent; main flows match, the details diverge |
| 3 | Largely consistent; an occasional deviation, nothing confusing |
| 4 | Fully consistent; a cohesive system with predictable behavior |

### 5. Error Prevention

Even better than good error messages is a design that stops problems before they happen.

**Check for**:
- Confirmation before destructive actions (delete, overwrite)
- Constraints preventing invalid input (date pickers, dropdowns)
- Smart defaults that reduce errors
- Clear labels that prevent misunderstanding
- Autosave and draft recovery

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Errors are easy to make; no guardrails anywhere |
| 1 | Few safeguards; some inputs validated, most not |
| 2 | Partial prevention; common errors caught, edge cases slip through |
| 3 | Good prevention; most error paths blocked proactively |
| 4 | Excellent; smart constraints make errors nearly impossible |

### 6. Recognition Rather Than Recall

Keep memory load low. Make objects, actions, and options visible or easy to retrieve.

**Check for**:
- Visible options (not buried in hidden menus)
- Contextual help when needed (tooltips, inline hints)
- Recent items and history
- Autocomplete and suggestions
- Labels on icons (not icon-only navigation)

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Heavy memorization; users have to recall paths and commands |
| 1 | Mostly recall; many hidden features, few visible cues |
| 2 | Some aids; main actions visible, secondary features hidden |
| 3 | Good recognition; most things discoverable, few memory demands |
| 4 | Everything discoverable; users never have to memorize |

### 7. Flexibility and Efficiency of Use

Accelerators, unseen by novices, speed up expert interaction.

**Check for**:
- Keyboard shortcuts for common actions
- Customizable interface elements
- Recent items and favorites
- Bulk/batch actions
- Power user features that don't complicate the basics

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | One rigid path; no shortcuts or alternatives |
| 1 | Limited flexibility; few alternatives to the main path |
| 2 | Some shortcuts; basic keyboard support, limited bulk actions |
| 3 | Good accelerators; keyboard nav, some customization |
| 4 | Highly flexible; multiple paths, power features, customizable |

### 8. Aesthetic and Minimalist Design

Interfaces shouldn't carry irrelevant or seldom-needed information. Each element should earn its place.

**Check for**:
- Only necessary information visible at each step
- Clear visual hierarchy directing attention
- Purposeful use of color and emphasis
- No decorative clutter competing for attention
- Focused, uncluttered layouts

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Overwhelming; everything competes equally for attention |
| 1 | Cluttered; too much noise, hard to find what matters |
| 2 | Some clutter; main content clear, the periphery noisy |
| 3 | Largely clean; focused design, minor visual noise |
| 4 | Perfectly minimal; every element earns its pixel |

### 9. Help Users Recognize, Diagnose, and Recover from Errors

Error messages should use plain language, point precisely at the problem, and helpfully propose a solution.

**Check for**:
- Plain language error messages (no error codes for users)
- Specific problem identification ("Email is missing @" not "Invalid input")
- Actionable recovery suggestions
- Errors displayed near the source of the problem
- Non-blocking error handling (don't wipe the form)

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Cryptic errors; codes, jargon, or no message at all |
| 1 | Vague errors; "Something went wrong" with no guidance |
| 2 | Clear but unhelpful; names the problem but not the fix |
| 3 | Clear with suggestions; identifies the problem and offers next steps |
| 4 | Perfect recovery; pinpoints the issue, suggests a fix, preserves user work |

### 10. Help and Documentation

Even when the system works without docs, help should be easy to locate, task-focused, and brief.

**Check for**:
- Searchable help or documentation
- Contextual help (tooltips, inline hints, guided tours)
- Task-focused organization (not feature-organized)
- Concise, scannable content
- Easy access without leaving current context

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | No help available anywhere |
| 1 | Help exists but is hard to find or irrelevant |
| 2 | Basic help; an FAQ or docs exist, not contextual |
| 3 | Good documentation; searchable, mostly task-focused |
| 4 | Excellent contextual help; the right info at the right moment |

---

## Score Summary

**Total possible**: 40 points (10 heuristics × 4 max)

| Score Range | Rating | What It Means |
|-------------|--------|---------------|
| 36–40 | Excellent | Minor polish only; ship it |
| 28–35 | Good | Address weak areas, solid foundation |
| 20–27 | Acceptable | Significant improvements needed before users are happy |
| 12–19 | Poor | Major UX overhaul required; core experience broken |
| 0–11 | Critical | Redesign needed; unusable in current state |

---

## Issue Severity (P0–P3)

Tag every individual issue found while scoring with a priority level:

| Priority | Name | Description | Action |
|----------|------|-------------|--------|
| **P0** | Blocking | Prevents task completion entirely | Fix immediately; this is a showstopper |
| **P1** | Major | Causes significant difficulty or confusion | Fix before release |
| **P2** | Minor | Annoyance, but workaround exists | Fix in next pass |
| **P3** | Polish | Nice-to-fix, no real user impact | Fix if time permits |

**Tip**: When you're torn between two levels, ask: "Would a user contact support about this?" If yes, it's at least P1.
