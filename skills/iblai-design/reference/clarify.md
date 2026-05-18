> **Additional context needed**: audience technical level and users' mental state in context.

Locate the unclear, confusing, or poorly written interface text and rewrite it. Vague copy generates support tickets and abandonment; specific copy carries users through the task.


---

## Assess Current Copy

Pin down what makes the text unclear or ineffective:

1. **Find clarity problems**:
   - **Jargon**: Technical terms users won't grasp
   - **Ambiguity**: More than one interpretation possible
   - **Passive voice**: "Your file has been uploaded" vs "We uploaded your file"
   - **Length**: Too wordy or too terse
   - **Assumptions**: Presuming user knowledge they lack
   - **Missing context**: Users don't know what to do or why
   - **Tone mismatch**: Too formal, too casual, or wrong for the situation

2. **Understand the context**:
   - Who's the audience? (Technical? General? First-time users?)
   - What's the user's mental state? (Stressed during error? Confident during success?)
   - What's the action? (What do we want users to do?)
   - What's the constraint? (Character limits? Space limitations?)

**CRITICAL**: Clear copy helps users succeed. Unclear copy breeds frustration, errors, and support tickets.

## Plan Copy Improvements

Form a strategy for clearer communication:

- **Primary message**: What's the ONE thing users need to know?
- **Action needed**: What should users do next (if anything)?
- **Tone**: How should this feel? (Helpful? Apologetic? Encouraging?)
- **Constraints**: Length limits, brand voice, localization considerations

**IMPORTANT**: Good UX writing is invisible. Users should grasp it instantly without noticing the words.

## Improve Copy Systematically

Tighten text across these common areas:

### Error Messages
**Bad**: "Error 403: Forbidden"
**Good**: "You don't have permission to view this page. Contact your admin for access."

**Bad**: "Invalid input"
**Good**: "Email addresses need an @ symbol. Try: name@example.com"

**Principles**:
- Describe what went wrong in plain language
- Suggest how to fix it
- Don't blame the user
- Include examples when helpful
- Link to help/support if applicable

### Form Labels & Instructions
**Bad**: "DOB (MM/DD/YYYY)"
**Good**: "Date of birth" (with placeholder showing format)

**Bad**: "Enter value here"
**Good**: "Your email address" or "Company name"

**Principles**:
- Use clear, specific labels (not generic placeholders)
- Show format expectations with examples
- Explain why you're asking (when not obvious)
- Place instructions before the field, not after
- Keep required field indicators clear

### Button & CTA Text
**Bad**: "Click here" | "Submit" | "OK"
**Good**: "Create account" | "Save changes" | "Got it, thanks"

**Principles**:
- Name the action specifically
- Use active voice (verb + noun)
- Match the user's mental model
- Be specific ("Save" beats "OK")

### Help Text & Tooltips
**Bad**: "This is the username field"
**Good**: "Choose a username. You can change this later in Settings."

**Principles**:
- Add value (don't merely echo the label)
- Answer the implicit question ("What is this?" or "Why do you need this?")
- Keep it brief yet complete
- Link to detailed docs if needed

### Empty States
**Bad**: "No items"
**Good**: "No projects yet. Create your first project to get started."

**Principles**:
- Explain why it's empty (if not obvious)
- Show the next action clearly
- Make it welcoming, not a dead end

### Success Messages
**Bad**: "Success"
**Good**: "Settings saved! Your changes will take effect immediately."

**Principles**:
- Confirm what happened
- Explain what comes next (if relevant)
- Be brief yet complete
- Match the user's emotional moment (celebrate big wins)

### Loading States
**Bad**: "Loading..." (for 30+ seconds)
**Good**: "Analyzing your data... this usually takes 30-60 seconds"

**Principles**:
- Set expectations (how long?)
- Explain what's happening (when it's not obvious)
- Show progress when possible
- Offer an escape hatch if appropriate ("Cancel")

### Confirmation Dialogs
**Bad**: "Are you sure?"
**Good**: "Delete 'Project Alpha'? This can't be undone."

**Principles**:
- State the specific action
- Explain consequences (especially for destructive actions)
- Use clear button labels ("Delete project" not "Yes")
- Don't overuse confirmations (only for risky actions)

### Navigation & Wayfinding
**Bad**: Generic labels like "Items" | "Things" | "Stuff"
**Good**: Specific labels like "Your projects" | "Team members" | "Settings"

**Principles**:
- Be specific and descriptive
- Use language users understand (not internal jargon)
- Make the hierarchy clear
- Account for information scent (breadcrumbs, current location)

## Apply Clarity Principles

Every piece of copy should obey these rules:

1. **Be specific**: "Enter email" not "Enter value"
2. **Be concise**: Cut unnecessary words (but never at the cost of clarity)
3. **Be active**: "Save changes" not "Changes will be saved"
4. **Be human**: "Oops, something went wrong" not "System error encountered"
5. **Tell users what to do**, not just what happened
6. **Be consistent**: Use the same terms throughout (don't vary for variety)

**NEVER**:
- Use jargon without explanation
- Blame users ("You made an error" → "This field is required")
- Be vague ("Something went wrong" without explanation)
- Use passive voice needlessly
- Write overly long explanations (be concise)
- Use humor for errors (be empathetic instead)
- Assume technical knowledge
- Vary terminology (settle on one term and keep it)
- Repeat information (headers restating intros, redundant explanations)
- Use placeholders as the only labels (they vanish once users type)

## Verify Improvements

Confirm the copy improvements actually land:

- **Comprehension**: Can users understand it without context?
- **Actionability**: Do users know what to do next?
- **Brevity**: Is it as short as it can be while staying clear?
- **Consistency**: Does it line up with terminology elsewhere?
- **Tone**: Is it right for the situation?

Once the copy reads cleanly, hand off to `/iblai-design polish` for the final pass.
