---
name: iblai-api-studio-problem
description: Add and edit problem (assessment) components in an Open edX unit on Studio — create a problem block (optionally from a boilerplate), write its OLX question markup in data, set display name, max attempts, weight, show-answer and randomization in metadata, and clear the stale markdown so the OLX is authoritative. Ships verified OLX for multiple choice, checkboxes, numerical, text and dropdown questions. Use when the user wants a quiz, question, exercise, assessment, graded check or any of those answer types. Session auth via studio.env.
metadata:
  kind: api
---

# iblai-api-studio-problem

A `problem` component is one or more questions written in **OLX** (Open
Learning XML). Create the block, then send the OLX as `data` with grading
metadata. Two calls. The OLX for each common question type is in
`references/olx.md`; copy it, do not improvise tags.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env` — run **`/iblai-api-studio-auth`** first.
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- **Keys:** parent = a unit locator; the block is `…+type@problem+block@<hex>`.
- Points count toward the grade only when the enclosing subsection has a `graderType` (`/iblai-api-studio-subsection`) that exists in the grading policy (`/iblai-api-studio-grading`).
- Draft until the unit is published. DELETE is destructive — confirm with the user first.

## Reads

- **GET** `/xblock/{problem}` — `{ "display_name", "category": "problem", "data": "<problem>…</problem>", "metadata": { "display_name", "max_attempts", "weight", "showanswer", "rerandomize", "markdown", … }, "published", "has_changes" }`.
- **GET** `/api/contentstore/v1/container/vertical/{unit}/children` — the unit's components (`block_type: "problem"`).

## Writes

- **POST** `/xblock/` — create:
  ```json
  { "parent_locator": "<unit>", "category": "problem", "boilerplate": "multiplechoice.yaml" }
  ```
  → `{ "locator": "…+type@problem+block@<hex>", "courseKey": "…" }`.
  `boilerplate` is optional and pre-fills template OLX + `markdown`. Verified names: `multiplechoice.yaml`, `checkboxes_response.yaml`; upstream also ships `numericalresponse.yaml`, `optionresponse.yaml`, `string_response.yaml`, `blank_common.yaml`. **An unknown name creates a blank problem without an error**, so do not rely on it — you overwrite `data` anyway.
- **POST** `/xblock/{problem}` — write the question:
  ```json
  { "data": "<problem>…OLX…</problem>",
    "metadata": { "display_name": "Quick check", "max_attempts": 2, "weight": 1, "showanswer": "finished", "rerandomize": "never" },
    "nullout": ["markdown"] }
  ```
  → `{ "id", "data": "<stored OLX>", "metadata": { …, "markdown": null } }`.
  Always include `"nullout": ["markdown"]`: boilerplates store a simple-editor `markdown` copy that Studio's editor would otherwise regenerate the OLX from, discarding your XML.
  `metadata` keys: `display_name`; `max_attempts` (integer; omit = unlimited); `weight` (points for the whole problem; default = number of responses); `showanswer` ∈ `always` · `answered` · `attempted` · `closed` · `finished` · `past_due` · `correct_or_past_due` · `never`; `rerandomize` ∈ `always` · `onreset` · `never` · `per_student`; `show_reset_button` (bool); `submission_wait_seconds` (integer).
- **POST** `/xblock/` `{ "duplicate_source_locator": "<problem>", "parent_locator": "<unit>" }` — copy.
- **DELETE** `/xblock/{problem}` → `204`. Confirm with the user first.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
UNIT="block-v1:acme+DATA101+2026-T1+type@vertical+block@645f5ded5f544adab9fb603c4afc3bac"

PROB=$(curl "${S[@]}" -X POST "$STUDIO_URL/xblock/" -d "{\"parent_locator\":\"$UNIT\",\"category\":\"problem\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["locator"])')

cat > q.xml <<'OLX'
<problem>
  <multiplechoiceresponse>
    <label>Which value is the median of 3, 9, 4, 7, 5?</label>
    <choicegroup type="MultipleChoice">
      <choice correct="false">4</choice>
      <choice correct="true">5</choice>
      <choice correct="false">7</choice>
    </choicegroup>
    <solution><div class="detailed-solution"><p>Sorted: 3 4 5 7 9 — the middle value is 5.</p></div></solution>
  </multiplechoiceresponse>
</problem>
OLX
python3 -c 'import json; print(json.dumps({"data": open("q.xml").read(),
  "metadata": {"display_name": "Median check", "max_attempts": 2, "weight": 1, "showanswer": "finished"},
  "nullout": ["markdown"]}))' | curl "${S[@]}" -X POST "$STUDIO_URL/xblock/$PROB" -d @-
```

## Authoring rules

- One `<problem>` root; one or more `*response` elements inside, each with its own `<label>` (the question text — required) and optional `<description>` (hint text under the label).
- Escape `<`, `>` and `&` in question text (`&lt;` …); OLX is XML. Validate it parses (`python3 -c 'import xml.dom.minidom,sys; xml.dom.minidom.parse("q.xml")'`) before sending — Studio stores invalid XML and the unit then fails to render for users.
- Feedback: `<choicehint>` inside a `<choice>`, and a `<solution>` block shown per `showanswer`.
- Partial credit for checkboxes: `<choiceresponse partial_credit="EDC">` (every-decision-counts); numeric tolerance: `<responseparam type="tolerance" default="5%"/>`.
- Randomized variants, custom Python graders and images are supported by OLX but out of scope here — start from `references/olx.md` and the Open edX "Problem OLX" docs for anything beyond the five types.

## Reference material

- `references/olx.md` — copy-ready OLX for multiple choice, checkboxes, numerical input, text input and dropdown, with hints and solutions, plus the metadata each usually pairs with.
