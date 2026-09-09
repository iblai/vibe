# Content type request bodies

Worked request bodies for each thing you can put in a course. Anything containing a list of
objects is shown as JSON, because bracket-encoded arrays of hashes are unreliable in Canvas.

Contents: [Pages](#pages) · [Assignments](#assignments) ·
[Discussions](#discussions-and-announcements) ·
[Classic quiz questions](#classic-quiz-questions) — the long one ·
[New Quizzes items](#new-quizzes-items) · [Syllabus and front page](#syllabus-and-front-page)

---

## Pages

```bash
curl -X POST "$CANVAS_API_URL/api/v1/courses/$CID/pages" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  --data-urlencode 'wiki_page[title]=Week 1 Overview' \
  --data-urlencode 'wiki_page[body]=<h2>This week</h2><p>Read chapters 1-3.</p>' \
  -d 'wiki_page[published]=true' \
  -d 'wiki_page[editing_roles]=teachers'
```

The response's `url` field is the slug (`week-1-overview`). Capture it — module items need
it, and it changes whenever the title changes.

Body HTML is sanitized. Allowed: headings, lists, tables, `<img>`, `<a>`, `<iframe>` from
allowlisted domains. Stripped: `<script>`, most inline event handlers, `<style>` blocks.
Build layout with Canvas's own classes (`content-box`, `grid-row`, `col-xs-12`) rather than
inline CSS if the institution has a theme.

To embed an uploaded file, link to `/courses/$CID/files/$FILE_ID/preview` — a bare
`download` link works but doesn't render inline.

---

## Assignments

```bash
curl -X POST "$CANVAS_API_URL/api/v1/courses/$CID/assignments" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  --data-urlencode 'assignment[name]=Problem Set 1' \
  --data-urlencode 'assignment[description]=<p>Show your working.</p>' \
  -d 'assignment[submission_types][]=online_upload' \
  -d 'assignment[submission_types][]=online_text_entry' \
  -d 'assignment[allowed_extensions][]=pdf' \
  -d 'assignment[allowed_extensions][]=docx' \
  -d 'assignment[points_possible]=100' \
  -d 'assignment[grading_type]=points' \
  -d 'assignment[assignment_group_id]='"$GROUP_ID" \
  -d 'assignment[due_at]=2026-09-08T23:59:00Z' \
  -d 'assignment[published]=true'
```

Gotchas worth knowing before you debug them:

- `submission_types[]=none` makes a gradebook column with no submission. `not_graded` makes
  it ungraded entirely and removes it from the gradebook.
- `due_at` is stored in UTC and displayed in the **course's** time zone. A due date of
  `23:59:00Z` on a course set to `Africa/Accra` shows as 23:59 (UTC+0) but as 18:59 in New
  York. Set `course[time_zone]` deliberately and compute due dates from it.
- A due date outside the course or term dates is accepted and then silently unavailable to
  students. Check `restrict_enrollments_to_course_dates`.
- `notify_of_update=true` on an update to a published assignment emails every student.
- Peer reviews need `peer_reviews=true` **and** `automatic_peer_reviews=true` +
  `peer_review_count` to actually assign anyone.

**Graded discussion** — create the discussion with a nested `assignment` object rather than
creating an assignment with `submission_types[]=discussion_topic`:

```json
{
  "title": "Week 1 Discussion",
  "message": "<p>Introduce yourself.</p>",
  "discussion_type": "threaded",
  "published": true,
  "assignment": {
    "points_possible": 10,
    "grading_type": "points",
    "assignment_group_id": 123,
    "due_at": "2026-09-08T23:59:00Z"
  }
}
```

---

## Discussions and announcements

```bash
curl -X POST "$CANVAS_API_URL/api/v1/courses/$CID/discussion_topics" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  --data-urlencode 'title=Introductions' \
  --data-urlencode 'message=<p>Tell us where you are joining from.</p>' \
  -d 'discussion_type=threaded' \
  -d 'require_initial_post=true' \
  -d 'published=true'
```

Add `-d 'is_announcement=true'` for an announcement. Announcements in a **published** course
notify enrolled users immediately unless you set `delayed_post_at` to a future time — this
is the most common way an automated build accidentally emails a cohort.

---

## Classic quiz questions

`POST /courses/:cid/quizzes/:qid/questions` with `Content-Type: application/json`.

Shared fields on every question:

```json
{
  "question": {
    "question_name": "Q1",
    "question_text": "<p>Which of these is a prime number?</p>",
    "question_type": "multiple_choice_question",
    "points_possible": 2,
    "position": 1,
    "correct_comments_html": "<p>Right.</p>",
    "incorrect_comments_html": "<p>Not quite.</p>",
    "neutral_comments_html": "<p>Review section 2.1.</p>",
    "quiz_group_id": null,
    "answers": []
  }
}
```

The `answers` format varies by type. `weight` is 100 for correct and 0 for incorrect
throughout.

**multiple_choice_question** — exactly one answer with weight 100.

```json
"answers": [
  {"text": "7",  "weight": 100, "comments_html": "<p>Correct.</p>"},
  {"text": "9",  "weight": 0},
  {"text": "15", "weight": 0}
]
```

**true_false_question** — exactly two answers, texts must be "True" and "False".

```json
"answers": [{"text": "True", "weight": 100}, {"text": "False", "weight": 0}]
```

**multiple_answers_question** — every correct option gets weight 100.

```json
"answers": [
  {"text": "Oxygen",  "weight": 100},
  {"text": "Nitrogen","weight": 100},
  {"text": "Helium",  "weight": 0}
]
```

**short_answer_question** (fill in the blank) — each accepted string is a weight-100 answer.
Matching is case-insensitive and whitespace-trimmed.

```json
"answers": [{"text": "mitochondria", "weight": 100},
            {"text": "mitochondrion", "weight": 100}]
```

**fill_in_multiple_blanks_question** — `question_text` contains `[blank_id]` placeholders and
each answer names its blank:

```json
"question_text": "<p>The [organ] pumps blood through the [vessel].</p>",
"answers": [
  {"text": "heart",  "weight": 100, "blank_id": "organ"},
  {"text": "aorta",  "weight": 100, "blank_id": "vessel"}
]
```

**multiple_dropdowns_question** — same `blank_id` mechanism, but every option for a blank is
listed and only one has weight 100.

```json
"question_text": "<p>Water boils at [temp] at sea level.</p>",
"answers": [
  {"text": "50 C",  "weight": 0,   "blank_id": "temp"},
  {"text": "100 C", "weight": 100, "blank_id": "temp"},
  {"text": "150 C", "weight": 0,   "blank_id": "temp"}
]
```

**matching_question** — each answer pairs `answer_match_left` with `answer_match_right`;
`matching_answer_incorrect_matches` is a newline-separated string of distractors.

```json
"answers": [
  {"answer_match_left": "Ghana",   "answer_match_right": "Accra"},
  {"answer_match_left": "Nigeria", "answer_match_right": "Abuja"}
],
"matching_answer_incorrect_matches": "Lagos\nKumasi"
```

**numerical_question** — `numerical_answer_type` is `exact_answer`, `range_answer` or
`precision_answer`.

```json
"answers": [
  {"numerical_answer_type": "exact_answer", "answer_exact": 3.14, "answer_error_margin": 0.01, "weight": 100},
  {"numerical_answer_type": "range_answer", "answer_range_start": 3.1, "answer_range_end": 3.2, "weight": 100}
]
```

**essay_question**, **file_upload_question** — no answers; both need manual grading and will
leave the quiz ungraded until a teacher scores them.

**text_only_question** — no answers, no points; used as an instruction block between
questions.

**calculated_question** (formula) — needs `formulas`, `variables` and pre-generated
`answers` with variable values. Building these correctly through the API is genuinely
painful; if a user needs formula questions, recommend authoring one in the UI and copying
the course, or use New Quizzes.

After bulk-adding questions, re-`PUT` the quiz once so `question_count` and
`points_possible` refresh:

```bash
curl -X PUT "$CANVAS_API_URL/api/v1/courses/$CID/quizzes/$QID" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" -d 'quiz[published]=true'
```

---

## New Quizzes items

Different API (`/api/quiz/v1/`), different vocabulary. An "item" wraps an "entry"; the entry
carries `interaction_type_slug` (the question type), `interaction_data` (the choices) and
`scoring_data` (the key).

```bash
curl -X POST "$CANVAS_API_URL/api/quiz/v1/courses/$CID/quizzes/$AID/items" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item": {
      "position": 1,
      "points_possible": 2,
      "entry_type": "Item",
      "entry": {
        "title": "Prime numbers",
        "item_body": "<p>Which of these is prime?</p>",
        "calculator_type": "none",
        "interaction_type_slug": "choice",
        "interaction_data": {
          "choices": [
            {"id": "a", "position": 1, "item_body": "<p>7</p>"},
            {"id": "b", "position": 2, "item_body": "<p>9</p>"}
          ]
        },
        "properties": {"shuffle_rules": {"choices": {"to_lock": [], "shuffled": false}}},
        "scoring_data": {"value": "a"},
        "scoring_algorithm": "Equivalence",
        "feedback": {"correct": "Right.", "incorrect": "Try again."}
      }
    }
  }'
```

`interaction_type_slug` values include `choice` (multiple choice), `multi-answer`,
`true-false`, `rich-fill-blank`, `matching`, `categorization`, `ordering`, `numeric`,
`formula`, `essay`, `file-upload`, `hot-spot`. Each pairs with a `scoring_algorithm`
(`Equivalence`, `PartialDeep`, `AllOrNothing`, `MultipleMethods`, `TextContainsAnswer`,
`None`) and its own `interaction_data` shape.

Two practical notes: the New Quizzes API often 404s on instances where the feature isn't
enabled, and `GET .../items` has been known to return an empty array on hosted Canvas even
for quizzes with questions. Verify a read round-trips before building a large import on top
of it.

---

## Syllabus and front page

```bash
# Syllabus is a field on the course, not a page
curl -X PUT "$CANVAS_API_URL/api/v1/courses/$CID" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  --data-urlencode 'course[syllabus_body]=<h2>Course outline</h2>...'

# Front page: mark a published page, then point the course at it
curl -X PUT "$CANVAS_API_URL/api/v1/courses/$CID/pages/course-home" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -d 'wiki_page[front_page]=true' -d 'wiki_page[published]=true'

curl -X PUT "$CANVAS_API_URL/api/v1/courses/$CID" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -d 'course[default_view]=wiki'
```

Setting `front_page=true` on an unpublished page fails quietly — publish first. If the user
wants the modules list as the landing page instead, `course[default_view]=modules` and skip
the front page entirely.
