# Problem OLX — the five common question types

Every snippet is a complete `data` value for `POST /xblock/{problem}`. Send it
with `"nullout": ["markdown"]` and the metadata shown. Question text goes in
`<label>`; keep the XML well-formed (escape `&lt;` `&gt;` `&amp;`).

**Combine, don't multiply.** A unit gets **one** problem block; put all of its
questions inside that block as sibling `*response` elements under the single
`<problem>` root (any mix of the types below). One problem block = one Submit
button = one graded item. Several problem blocks in a unit force users to
submit each question separately and list each as its own assignment — avoid
it. `weight` applies to the block and is split evenly across its questions,
so `weight = number of questions` gives one point each.

## Multiple choice (one correct answer)

```xml
<problem>
  <multiplechoiceresponse>
    <label>Which statement about the mean is true?</label>
    <description>Pick the single best answer.</description>
    <choicegroup type="MultipleChoice">
      <choice correct="false">It is always one of the observed values.<choicehint>The mean can fall between values.</choicehint></choice>
      <choice correct="true">It is sensitive to outliers.<choicehint>Correct — one extreme value shifts it.</choicehint></choice>
      <choice correct="false">It equals the median in every dataset.</choice>
    </choicegroup>
    <solution><div class="detailed-solution"><p>The mean sums every value, so an outlier pulls it.</p></div></solution>
  </multiplechoiceresponse>
</problem>
```

Add `shuffle="true"` on `<choicegroup>` to randomize order (`fixed="true"` on a choice pins it, e.g. "All of the above").
Typical metadata: `{"max_attempts": 2, "weight": 1, "showanswer": "finished"}`.

## Checkboxes (several correct answers)

```xml
<problem>
  <choiceresponse partial_credit="EDC">
    <label>Select every measure of spread.</label>
    <checkboxgroup>
      <choice correct="true">Standard deviation</choice>
      <choice correct="true">Interquartile range</choice>
      <choice correct="false">Mode</choice>
      <choice correct="false">Median</choice>
    </checkboxgroup>
    <solution><div class="detailed-solution"><p>Mode and median describe the center, not the spread.</p></div></solution>
  </choiceresponse>
</problem>
```

Drop `partial_credit="EDC"` for all-or-nothing grading. Typical metadata: `{"max_attempts": 3, "weight": 2}`.

## Numerical input

```xml
<problem>
  <numericalresponse answer="12.5">
    <label>What is the mean of 10, 15, 12 and 13?</label>
    <description>Round to one decimal place.</description>
    <responseparam type="tolerance" default="0.1"/>
    <formulaequationinput/>
    <solution><div class="detailed-solution"><p>(10 + 15 + 12 + 13) / 4 = 12.5</p></div></solution>
  </numericalresponse>
</problem>
```

`answer` may be a number or an expression (`"[10,15]"` for a closed range, `"2*pi"`); tolerance `"5%"` or an absolute value.
Typical metadata: `{"max_attempts": 3, "weight": 1, "showanswer": "attempted"}`.

## Text input (string match)

```xml
<problem>
  <stringresponse answer="median" type="ci">
    <label>Which measure of center is unaffected by extreme values?</label>
    <additional_answer answer="the median"/>
    <textline size="30"/>
    <stringequalhint answer="mean">The mean moves with every value.</stringequalhint>
    <solution><div class="detailed-solution"><p>The median depends only on the middle position.</p></div></solution>
  </stringresponse>
</problem>
```

`type="ci"` = case-insensitive; `type="ci regexp"` to match a regular expression in `answer`.
Typical metadata: `{"max_attempts": 3, "weight": 1}`.

## Dropdown (select one option)

```xml
<problem>
  <optionresponse>
    <label>A histogram with a long right tail is…</label>
    <optioninput>
      <option correct="False">symmetric</option>
      <option correct="True">right-skewed<optionhint>The tail points to the larger values.</optionhint></option>
      <option correct="False">left-skewed</option>
    </optioninput>
    <solution><div class="detailed-solution"><p>Skew is named after the direction of the tail.</p></div></solution>
  </optionresponse>
</problem>
```

Typical metadata: `{"max_attempts": 2, "weight": 1}`.

## Several questions in one problem

Put more than one `*response` element under `<problem>`; each needs its own
`<label>`. `weight` then applies to the whole block and is split evenly across
responses (a 2-response problem with `weight: 4` gives 2 points each).

## Metadata cheat sheet

| Key | Meaning | Typical |
|---|---|---|
| `display_name` | title shown to users | question topic |
| `max_attempts` | attempts before locking (omit = unlimited) | `1`–`3` |
| `weight` | points for the block | `1` |
| `showanswer` | when "Show answer" appears: `always` · `answered` · `attempted` · `closed` · `finished` · `past_due` · `correct_or_past_due` · `never` | `finished` |
| `rerandomize` | `always` · `onreset` · `never` · `per_student` (only matters with randomized scripts) | `never` |
| `show_reset_button` | let users clear their answer | `false` |
| `submission_wait_seconds` | cooldown between submissions | `0` |
