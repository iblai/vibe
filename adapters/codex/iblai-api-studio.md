# iblai-api-studio

> Family index for authoring Open edX courses directly on Studio (studio.learn.iblai.app) and verifying them on the LMS (lms.ibl.ai) from the terminal — sign-in capture, course create, section/subsection/unit outline, HTML/PDF/problem components, course settings, team, grading policy, publish, and LMS-side checks. Use when the user says Studio, Open edX, edX, xblock, course outline, section/subsection/unit, "build a course on our LMS", or asks which /iblai-api-studio-* skill to run; routes to the right skill and gives the build order.

# iblai-api-studio — author a course on Open edX Studio

Studio is the Open edX CMS behind the ibl.ai LMS. The `/iblai-api-studio-*`
skills drive it over its own session-authenticated HTTP endpoints (no UI, no
Api-Token) and check the result on the LMS the way `lms.ibl.ai` does. Each
skill is one capability with verified endpoints; this page is the map.

| Where | Production | Test server |
|---|---|---|
| Studio (authoring) | `https://studio.learn.iblai.app` | `https://studio.learn.iblai.org` |
| LMS API (user data) | `https://learn.iblai.app` | `https://learn.iblai.org` |
| LMS app | `https://lms.ibl.ai` | `https://lms.iblai.org` |

Users only ever open **Studio** and the **LMS app**; the LMS API host is
where the LMS app reads from and is used here only for verification calls.

## Build order

```
0. /iblai-api-studio-auth            sign in once → studio.env (cookies), STUDIO_ORG
1. /iblai-api-studio-course-create   POST /api/ibl/manage/course/  → course_key
2. /iblai-api-studio-section         chapter      ─┐
3. /iblai-api-studio-subsection      sequential    ├─ POST /xblock/ {parent_locator, category}
4. /iblai-api-studio-unit            vertical     ─┘
5. /iblai-api-studio-html            html block: data = HTML
   /iblai-api-studio-problem         problem block: data = OLX (+ boilerplate)
   /iblai-api-studio-pdf             pdf block: advanced module + asset upload + save_pdf handler
6. /iblai-api-studio-settings        dates, description, images, intro video, catalog fields, advanced settings
7. /iblai-api-studio-grading         assignment types, weights, cutoffs ← subsections reference these
8. /iblai-api-studio-team            staff / instructor by email
9. /iblai-api-studio-publish         {publish: "make_public"} on units/sections/course; verify state
10. /iblai-api-studio-lms            enroll, published outline/blocks, course details, catalog visibility
```

Steps 6–8 can happen any time after 1. Nothing is visible to users until
step 9; the LMS app lists the course as soon as step 1 runs.

## Keys you will pass around

| Thing | Shape | Where it comes from |
|---|---|---|
| course key | `course-v1:<org>+<number>+<run>` | course create response `course_key` |
| course root block | `block-v1:<org>+<number>+<run>+type@course+block@course` | derived from the course key; the `parent_locator` for sections |
| any block (usage key) | `block-v1:<org>+<number>+<run>+type@<category>+block@<hex>` | `locator` from `POST /xblock/` |
| category | `chapter` · `sequential` · `vertical` · `html` · `problem` · `pdf` | fixed |

**URL-encode course keys in query strings** (`course_key=course-v1%3Aorg%2Bnum%2Brun`);
path segments accept them raw.

## The snippet every skill starts with

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
curl "${S[@]}" -X POST "$STUDIO_URL/xblock/" -d '{"parent_locator":"…","category":"chapter","display_name":"Week 1"}'
```

`Accept: application/json` is what makes Studio answer JSON instead of a page;
`X-CSRFToken` + `Origin` are what make writes pass CSRF. A `302` to `/login`
means the session expired → `/iblai-api-studio-auth`.

## Which skill when

| The user wants… | Skill |
|---|---|
| "connect", "log in to Studio", a call returned 302/403 | `/iblai-api-studio-auth` |
| a new course, list my courses, the course key | `/iblai-api-studio-course-create` |
| weeks/modules/sections; rename, reorder, release dates, hide from users | `/iblai-api-studio-section` |
| lessons/subsections; due dates, graded as Homework/Exam, timed | `/iblai-api-studio-subsection` |
| units/pages inside a lesson; order components; duplicate; delete | `/iblai-api-studio-unit` |
| text, reading, rich content, images, embeds | `/iblai-api-studio-html` |
| a PDF reader block | `/iblai-api-studio-pdf` |
| quiz, question, multiple choice, checkbox, numeric, text, dropdown answers | `/iblai-api-studio-problem` |
| start/end/enrollment dates, description, about page, course image, intro video, pacing, language, catalog tags, advanced settings, uploads | `/iblai-api-studio-settings` |
| who can edit the course; add/remove staff or instructors | `/iblai-api-studio-team` |
| grading policy, assignment types, weights, pass mark, grace period | `/iblai-api-studio-grading` |
| make it live, publish, discard draft, "why can't users see it" | `/iblai-api-studio-publish` |
| enroll a user, what the user sees, is it in the catalog | `/iblai-api-studio-lms` |

Outside this family: AI-generated course drafts through the ibl.ai pipeline →
`/iblai-vibe-course-create`; org roles (`course-creator`, `org-instructor`) and
user admin → `/iblai-api-management`; catalog programs/pathways/enrollment with
an Api-Token → `/iblai-api-catalog`; Canvas → `/iblai-api-canvas-course-builder`.

## Reporting back

End with the course key, the LMS app URL
`$LMS_APP_URL/platform/<org>/courses/<course_key>`, counts (sections /
subsections / units / components), publish state, and anything that failed.
An unpublished build is invisible to users — say so explicitly.