# iblai-api-studio-grading

> Read and set an Open edX course's grading policy on Studio — assignment types (Homework, Lab, Exam…) with min_count, drop_count, short_label and weight, the letter-grade cutoffs, grace period and minimum credit grade; replace the whole policy or edit one assignment type. Use when the user says grading policy, assignment types, weights, pass mark, letter grades, drop the lowest, grace period, or "how is the course graded". Session auth via studio.env. For the build order and the other Studio skills, see /iblai-api-studio.

# iblai-api-studio-grading

The grading policy is one JSON object per course: a list of **graders**
(assignment types) and the **grade cutoffs**. Subsections reference a grader by
its `type` (`/iblai-api-studio-subsection` `graderType`), and each grader's
`weight` decides its share of the final grade. Replace the whole object or
patch one grader by index.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s; otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. A course key from `/iblai-api-studio-course-create`.
3. Set the policy **before** creating graded subsections (`graderType` must name an existing type) and before the first publish; decide the pass mark and letter grades with the user.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env` (its values are single-quoted — bash strips the quotes; any other parser must strip them too, or Studio answers 500: `/iblai-api-studio-auth`).
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- `COURSE="course-v1:<org>+<number>+<run>"` (raw in the path).
- Weights are percentages that should sum to **100**; Studio does **not** enforce it — check before writing.
- Changing a grader's `type` orphans subsections that reference the old name (they become ungraded) — rename with care.

## Reads

- **GET** `/settings/grading/{COURSE}` →
  ```json
  { "graders": [ { "id": 0, "type": "Homework", "min_count": 4, "drop_count": 1, "short_label": "HW", "weight": 40.0 },
                 { "id": 1, "type": "Final Exam", "min_count": 1, "drop_count": 0, "short_label": "Final", "weight": 60.0 } ],
    "grade_cutoffs": { "Pass": 0.6 },
    "grace_period": null,
    "minimum_grade_credit": 0.8 }
  ```
  `grace_period` is `null` when zero, otherwise `{ "hours", "minutes" }`.
- **GET** `/settings/grading/{COURSE}/{index}` → one grader object (index = position in `graders`, 0-based).
- The outline root (`GET /xblock/outline/<course root>`, see `/iblai-api-studio-section`) lists the current type names in `course_graders`.

## Writes

- **POST** `/settings/grading/{COURSE}` — replace the whole policy (send every grader you want to keep):
  ```json
  { "graders": [
      { "id": 0, "type": "Homework",   "min_count": 4, "drop_count": 1, "short_label": "HW",    "weight": 40 },
      { "id": 1, "type": "Final Exam", "min_count": 1, "drop_count": 0, "short_label": "Final", "weight": 60 } ],
    "grade_cutoffs": { "A": 0.85, "B": 0.7, "Pass": 0.5 },
    "grace_period": { "hours": 0, "minutes": 30 },
    "minimum_grade_credit": 0.8 }
  ```
  → the stored policy in the read shape. Fields: `type` (name shown to users, unique); `min_count` (how many of this type the course will have — used to compute the average, missing ones count as 0); `drop_count` (lowest scores ignored); `short_label` (progress-page abbreviation); `weight` (percent of final grade).
  `grade_cutoffs`: letter → minimum fraction. **Pass/fail** courses use exactly `{ "Pass": 0.5 }`; letter grades use `A`, `B`, `C`, … with **no `Pass`** (the lowest letter is the pass mark). Values descending, all between 0 and 1.
- **POST** `/settings/grading/{COURSE}/{index}` — create or update one grader (index = its position; use the next free index to append):
  ```json
  { "id": 1, "type": "Lab", "min_count": 6, "drop_count": 2, "short_label": "Lab", "weight": 20 }
  ```
  → the grader as stored.
- **DELETE** `/settings/grading/{COURSE}/{index}` → removes that grader. Confirm with the user first (subsections of that type become ungraded).

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
COURSE="course-v1:acme+DATA101+2026-T1"

curl "${S[@]}" -X POST "$STUDIO_URL/settings/grading/$COURSE" -d '{
  "graders": [
    {"id":0,"type":"Homework","min_count":6,"drop_count":1,"short_label":"HW","weight":40},
    {"id":1,"type":"Project","min_count":1,"drop_count":0,"short_label":"Proj","weight":30},
    {"id":2,"type":"Final Exam","min_count":1,"drop_count":0,"short_label":"Final","weight":30}],
  "grade_cutoffs": {"Pass": 0.6}, "grace_period": {"hours": 0, "minutes": 0}, "minimum_grade_credit": 0.8}' \
  | python3 -c 'import sys,json; p=json.load(sys.stdin); print([(g["type"], g["weight"]) for g in p["graders"]], p["grade_cutoffs"])'
```

## Notes

- New courses ship with four default graders (Homework 15 / Lab 15 / Midterm Exam 30 / Final Exam 40) and `{"Pass": 0.5}`; replace them rather than appending.
- A grader with `min_count` larger than the number of subsections of that type drags the average down (missing assignments score 0) — set `min_count` to the real number of assignments.
- `weight` for a type with no graded subsections still counts (as 0) — remove unused types.
- What users see: `GET $LMS_URL/api/course_home/progress/{COURSE}` → `grading_policy.assignment_policies` (weights as fractions) and `grade_range` (`/iblai-api-studio-lms`).