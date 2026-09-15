# iblai-api-studio-problem

> Add and edit problem (assessment) components in an Open edX unit on Studio — create ONE problem block per unit that holds all of the unit's questions as several OLX responses, write the OLX in data, set display name, max attempts, weight, show-answer and randomization in metadata, and clear the stale markdown so the OLX is authoritative. Ships verified OLX for multiple choice, checkboxes, numerical, text and dropdown questions with hints and solutions. Use when the user wants a quiz, questions, exercise, assessment, knowledge check or any of those answer types. Session auth via studio.env; run the auth preflight first.

# iblai-api-studio-problem

A `problem` component is a **set of questions** written in **OLX** (Open
Learning XML): one `<problem>` root with one `*response` element per
question. Users answer all of them and press *Submit* once; the block is
graded as one item. Create the block, then send the OLX as `data` with
grading metadata. Two calls per unit.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s; otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. A unit locator from `/iblai-api-studio-unit` (or the unit list from `/iblai-api-studio-outline`).
3. For graded work: the enclosing subsection has a `graderType` (`/iblai-api-studio-subsection`) that exists in the grading policy (`/iblai-api-studio-grading`).
4. The questions drafted and the OLX validated as XML (below).

## The one rule: one problem block per unit

Put **all** of a unit's questions into **one** `problem` block, as several
`<multiplechoiceresponse>` / `<choiceresponse>` / … elements under the same
`<problem>`. Several problem blocks in one unit mean several *Submit* buttons,
several graded items, and a progress page that lists each question as its
own assignment — that is against Open edX practice and confuses users.
The same goes for other component types: one block of a kind per unit unless
there is a reason a user should see them as separate items.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env` (its values are single-quoted — bash strips the quotes; any other parser must strip them too, or Studio answers 500: `/iblai-api-studio-auth`).
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- **Keys:** parent = a unit locator; the block is `…+type@problem+block@<hex>`.
- Draft until the unit is published. DELETE is destructive — confirm with the user first.

## Reads

- **GET** `/xblock/{problem}` — `{ "display_name", "category": "problem", "data": "<problem>…</problem>", "metadata": { "display_name", "max_attempts", "weight", "showanswer", "rerandomize", "markdown", … }, "published", "has_changes" }`.
- **GET** `/api/contentstore/v1/container/vertical/{unit}/children` — the unit's components (`block_type: "problem"`).

## Writes

- **POST** `/xblock/` — create:
  ```json
  { "parent_locator": "<unit>", "category": "problem" }
  ```
  → `{ "locator": "…+type@problem+block@<hex>", "courseKey": "…" }`.
  Optional `"boilerplate"` pre-fills template OLX + `markdown` (verified names: `multiplechoice.yaml`, `checkboxes_response.yaml`; upstream also `numericalresponse.yaml`, `optionresponse.yaml`, `string_response.yaml`, `blank_common.yaml`). **An unknown name creates a blank problem without an error**; you overwrite `data` anyway, so omit it.
- **POST** `/xblock/{problem}` — write the questions:
  ```json
  { "data": "<problem>…OLX with one or more responses…</problem>",
    "metadata": { "display_name": "Check your understanding", "max_attempts": 3, "weight": 3, "showanswer": "finished", "rerandomize": "never" },
    "nullout": ["markdown"] }
  ```
  → `{ "id", "data": "<stored OLX>", "metadata": { …, "markdown": null } }`.
  Always include `"nullout": ["markdown"]`: boilerplates store a simple-editor `markdown` copy that Studio's editor would otherwise regenerate the OLX from, discarding your XML.
  `metadata` keys: `display_name`; `max_attempts` (integer; omit = unlimited); `weight` (points for the whole block, split evenly across responses — set it to the number of questions for one point each); `showanswer` ∈ `always` · `answered` · `attempted` · `closed` · `finished` · `past_due` · `correct_or_past_due` · `never`; `rerandomize` ∈ `always` · `onreset` · `never` · `per_student`; `show_reset_button` (bool); `submission_wait_seconds` (integer).
- **POST** `/xblock/` `{ "duplicate_source_locator": "<problem>", "parent_locator": "<unit>" }` — copy.
- **DELETE** `/xblock/{problem}` → `204`. Confirm with the user first.
- Bulk: in `/iblai-api-studio-outline` the same block is `{ "problem_type": "blank", "data": "<OLX>", "metadata": { …, "markdown": null } }` inside a unit's `problems`.

## Example — one block, three questions

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
UNIT="block-v1:acme+DATA101+2026-T1+type@vertical+block@645f5ded5f544adab9fb603c4afc3bac"

cat > q.xml <<'OLX'
<problem>
  <multiplechoiceresponse>
    <label>Which value is the median of 3, 9, 4, 7, 5?</label>
    <choicegroup type="MultipleChoice" shuffle="true">
      <choice correct="false">4<choicehint>Sort first: 3 4 5 7 9.</choicehint></choice>
      <choice correct="true">5<choicehint>Correct — the middle of the sorted list.</choicehint></choice>
      <choice correct="false">7</choice>
    </choicegroup>
    <solution><div class="detailed-solution"><p>Sorted: 3 4 5 7 9 — the middle value is 5.</p></div></solution>
  </multiplechoiceresponse>

  <choiceresponse partial_credit="EDC">
    <label>Select every measure of spread.</label>
    <checkboxgroup>
      <choice correct="true">Standard deviation</choice>
      <choice correct="true">Interquartile range</choice>
      <choice correct="false">Mode</choice>
    </checkboxgroup>
  </choiceresponse>

  <numericalresponse answer="12.5">
    <label>What is the mean of 10, 15, 12 and 13?</label>
    <responseparam type="tolerance" default="0.1"/>
    <formulaequationinput/>
    <solution><div class="detailed-solution"><p>(10 + 15 + 12 + 13) / 4 = 12.5</p></div></solution>
  </numericalresponse>
</problem>
OLX
python3 -c 'import xml.dom.minidom; xml.dom.minidom.parse("q.xml")' || exit 1      # never send invalid XML

PROB=$(curl "${S[@]}" -X POST "$STUDIO_URL/xblock/" -d "{\"parent_locator\":\"$UNIT\",\"category\":\"problem\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["locator"])')
python3 -c 'import json; print(json.dumps({"data": open("q.xml").read(),
  "metadata": {"display_name": "Check your understanding", "max_attempts": 3, "weight": 3, "showanswer": "finished"},
  "nullout": ["markdown"]}))' | curl "${S[@]}" -X POST "$STUDIO_URL/xblock/$PROB" -d @-
```

## The five response types at a glance

| Type | Element | Answer markup |
|---|---|---|
| Multiple choice | `<multiplechoiceresponse>` | `<choicegroup type="MultipleChoice"><choice correct="true">…</choice></choicegroup>` |
| Checkboxes | `<choiceresponse partial_credit="EDC">` | `<checkboxgroup><choice correct="true">…</choice></checkboxgroup>` |
| Numerical | `<numericalresponse answer="12.5">` | `<responseparam type="tolerance" default="0.1"/><formulaequationinput/>` |
| Text | `<stringresponse answer="median" type="ci">` | `<textline size="30"/>` |
| Dropdown | `<optionresponse>` | `<optioninput><option correct="True">right-skewed</option><option correct="False">symmetric</option></optioninput>` — **nested `<option>` elements; the `options="('a','b')" correct="a"` attribute form is not valid here** |

Full snippets with hints and solutions: `references/olx.md`.

## Authoring rules

- Questions test the unit's objective, at the unit's level, in the unit's terms; distractors are plausible mistakes, not jokes or throwaways. Questions drafted by a sub-agent are reviewed against the content brief (`/iblai-api-studio` "Content quality") for alignment, difficulty, consistency with the reading and valid OLX before they are posted — the block goes live as written.
- One `<problem>` root; one `*response` per question, each with its own `<label>` (required) and optional `<description>` (hint under the label). Mix types freely.
- Every choice gets a `<choicehint>` where feedback helps; every question gets a `<solution>` — formative value comes from the explanation, not the score.
- `shuffle="true"` on `<choicegroup>`/`<checkboxgroup>` unless option order carries meaning (`fixed="true"` pins "All of the above").
- Escape `<`, `>` and `&` in question text (`&lt;` …); OLX is XML. Validate before sending — Studio stores invalid XML and the unit then fails to render for users.
- Partial credit for checkboxes: `<choiceresponse partial_credit="EDC">`; numeric tolerance: `<responseparam type="tolerance" default="5%"/>`.
- Formative check inside a lesson: `max_attempts` 2–3, `showanswer: finished`, weight = question count, subsection `notgraded`. Summative: `max_attempts: 1`, `showanswer: past_due` or `never`, in a graded subsection.
- Randomized variants, custom Python graders and images are supported by OLX but out of scope here — start from `references/olx.md` and the Open edX "Problem OLX" docs for anything beyond the five types.

## Reference material

- `references/olx.md` — copy-ready OLX for multiple choice, checkboxes, numerical input, text input and dropdown, with hints and solutions, the multi-question pattern, and the metadata cheat sheet.