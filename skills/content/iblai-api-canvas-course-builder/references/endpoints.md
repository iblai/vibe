# Canvas API endpoint and parameter cheat sheet

All paths are relative to `https://<canvas>/api/v1` unless marked otherwise. Auth is
`Authorization: Bearer <token>` on every request. Anywhere an ID appears you may substitute
`sis_course_id:X`, `sis_user_id:X`, `sis_section_id:X` (URL-encode the colon).

Contents: [Discovery](#discovery) · [Courses](#courses) · [Sections](#sections) ·
[Assignment groups](#assignment-groups) · [Modules](#modules) ·
[Module items](#module-items) · [Pages](#pages) · [Assignments](#assignments) ·
[Discussions and announcements](#discussions-and-announcements) ·
[Classic quizzes](#classic-quizzes) · [New Quizzes](#new-quizzes) · [Files](#files) ·
[Enrollments and users](#enrollments-and-users) ·
[Content migrations](#content-migrations) · [Tabs and settings](#tabs-and-settings)

---

## Discovery

| Purpose                     | Call                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| Who is this token?          | `GET /users/self`                                                |
| Which accounts can I admin? | `GET /accounts` (empty ⇒ not an admin)                           |
| Sub-accounts                | `GET /accounts/:id/sub_accounts?recursive=true`                  |
| Enrollment terms            | `GET /accounts/:id/terms`                                        |
| Courses in an account       | `GET /accounts/:id/courses?per_page=100`                         |
| My courses                  | `GET /courses?enrollment_type=teacher`                           |
| Token scopes / permissions  | `GET /accounts/:id/permissions?permissions[]=manage_courses_add` |

---

## Courses

**Create** — `POST /accounts/:account_id/courses`

Most fields nest under `course[...]`. Four do **not** — `offer`, `enroll_me`,
`skip_course_template` and `enable_sis_reactivation` are top-level. Sending them as
`course[offer]` is accepted and silently ignored.

| Parameter                                                                                                    | Notes                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `course[name]`                                                                                               | Defaults to "Unnamed Course" if omitted                                                               |
| `course[course_code]`                                                                                        | Short code shown on the course card                                                                   |
| `course[start_at]` / `course[end_at]`                                                                        | ISO8601. **Ignored unless `restrict_enrollments_to_course_dates` is true** — see below                |
| `course[restrict_enrollments_to_course_dates]`                                                               | Must be true to set course dates at all                                                               |
| `course[license]`                                                                                            | `private`, `cc_by_nc_nd`, `cc_by_nc_sa`, `cc_by_nc`, `cc_by_nd`, `cc_by_sa`, `cc_by`, `public_domain` |
| `course[is_public]`                                                                                          | Public to authenticated _and_ unauthenticated users                                                   |
| `course[is_public_to_auth_users]`                                                                            | Public to authenticated users only                                                                    |
| `course[public_syllabus]`, `course[public_syllabus_to_auth]`                                                 |                                                                                                       |
| `course[public_description]`                                                                                 | Publicly visible description                                                                          |
| `course[syllabus_body]`                                                                                      | HTML                                                                                                  |
| `course[default_view]`                                                                                       | `feed`, `wiki`, `modules`, `syllabus`, `assignments`                                                  |
| `course[time_zone]`                                                                                          | IANA name (`Africa/Accra`) or a Rails zone name                                                       |
| `course[term_id]`                                                                                            | Enrollment term                                                                                       |
| `course[sis_course_id]`, `course[integration_id]`                                                            | Require SIS permissions                                                                               |
| `course[hide_final_grades]`                                                                                  |                                                                                                       |
| `course[apply_assignment_group_weights]`                                                                     | Required for assignment group weights to apply                                                        |
| `course[grading_standard_id]`                                                                                | **Omitting this un-sets any existing grading standard**                                               |
| `course[grade_passback_setting]`                                                                             | `nightly_sync`, `disabled`, or `''` (update allows only `nightly_sync` and `''`)                      |
| `course[course_format]`                                                                                      | `on_campus`, `online`, `blended`                                                                      |
| `course[post_manually]`                                                                                      | true = grades must be posted manually, never auto-posted                                              |
| `course[allow_student_wiki_edits]`, `course[allow_wiki_comments]`, `course[allow_student_forum_attachments]` |                                                                                                       |
| `course[open_enrollment]`, `course[self_enrollment]`                                                         |                                                                                                       |
| `offer`                                                                                                      | _Top-level._ true publishes immediately — usually leave false                                         |
| `enroll_me`                                                                                                  | _Top-level._ Enrolls the calling user as teacher                                                      |
| `skip_course_template`                                                                                       | _Top-level._ Prevents the account's course template being copied in                                   |
| `enable_sis_reactivation`                                                                                    | _Top-level._ Reactivates a deleted course with a matching `sis_course_id`                             |

Two silent failures worth pre-empting:

- **Course dates need a flag.** `start_at` and `end_at` are discarded unless
  `restrict_enrollments_to_course_dates` is true. No error, no warning — the course simply
  has no dates, and every "why is my assignment unavailable" question follows from it.
- **Account templates apply automatically.** If the account has a course template
  configured, a newly created course arrives already populated with its content. Pass
  `skip_course_template=true` when you want a genuinely empty shell to build into.

Returns a Course object with `id` and `workflow_state` (`unpublished` / `available` /
`completed` / `deleted`).

**Update** — `PUT /courses/:id`, same `course[...]` fields (minus `enroll_me`), plus:

| `course[event]` | Effect                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `offer`         | Publish — make visible to students                                            |
| `claim`         | Unpublish. Fails once any student has a **graded** submission                 |
| `conclude`      | Prevent future enrollments, make read-only; stays in prior-enrollment lists   |
| `delete`        | Remove entirely; all enrollments deleted                                      |
| `undelete`      | Attempt recovery (account admin only, not guaranteed, comes back unpublished) |

Update-only fields include `course[account_id]` (move the course to another account),
`course[blueprint]` and `course[blueprint_restrictions_by_object_type]`,
`course[template]`, `course[homeroom_course]`, `course[course_color]`,
`course[friendly_name]`, and `course[syllabus_course_summary]`.

**Bulk publish** — `PUT /accounts/:id/courses` with `event=offer` and repeated
`course_ids[]`. Max **500 courses per call**; `event` here accepts only
`offer|conclude|delete|undelete` — **not `claim`**. Returns a Progress object; poll
`GET /progress/:id`.

**Other** — `GET /courses/:id?include[]=syllabus_body&include[]=term`
(add `include[]=all_courses` to also find recently deleted courses),
`DELETE /courses/:id?event=delete|conclude`,
`POST /courses/:id/reset_content` (wipes content, keeps users — destructive),
`GET /courses/:id/settings`, `PUT /courses/:id/settings`.

---

## Sections

- `POST /courses/:id/sections` — `course_section[name]`, `course_section[sis_section_id]`,
  `course_section[start_at]`, `course_section[end_at]`,
  `course_section[restrict_enrollments_to_section_dates]`
- `GET /courses/:id/sections`, `PUT /sections/:id`, `DELETE /sections/:id`
- Every course has a default section named after the course; you rarely need more.

---

## Assignment groups

`POST /courses/:id/assignment_groups`

| Parameter      | Notes                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| `name`         | e.g. "Homework"                                                             |
| `position`     | 1-based                                                                     |
| `group_weight` | Percent; only applied when `course[apply_assignment_group_weights]` is true |
| `rules`        | e.g. `drop_lowest:1\n` (newline-separated string)                           |

Note these fields are **not** nested under a wrapper key. `GET /courses/:id/assignment_groups`, `PUT`/`DELETE /courses/:id/assignment_groups/:id`.

---

## Modules

`POST /courses/:course_id/modules`

| Parameter                             | Notes                                         |
| ------------------------------------- | --------------------------------------------- |
| `module[name]`                        | **Required**                                  |
| `module[position]`                    | 1-based                                       |
| `module[unlock_at]`                   | DateTime                                      |
| `module[require_sequential_progress]` | Items must be completed in order              |
| `module[prerequisite_module_ids][]`   | Must have _lower_ position or they're ignored |
| `module[publish_final_grade]`         |                                               |

`PUT /courses/:course_id/modules/:id` accepts the same plus **`module[published]`** — you
cannot set `published` at create time, so publishing modules is always a second call.

`PUT /courses/:course_id/modules/:id/relock` — recompute progressions after adding
requirements to a live course. Without this, students who already unlocked a module stay
unlocked.

---

## Module items

`POST /courses/:course_id/modules/:module_id/items`

| Parameter                                        | Notes                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `module_item[type]`                              | **Required.** `File`, `Page`, `Discussion`, `Assignment`, `Quiz`, `SubHeader`, `ExternalUrl`, `ExternalTool` |
| `module_item[content_id]`                        | **Required except** for `ExternalUrl`, `Page`, `SubHeader`                                                   |
| `module_item[page_url]`                          | **Required for `Page`** — the slug, not the id                                                               |
| `module_item[external_url]`                      | Required for `ExternalUrl` and `ExternalTool`                                                                |
| `module_item[title]`                             | Overrides the linked object's title in the module listing                                                    |
| `module_item[position]`                          | 1-based                                                                                                      |
| `module_item[indent]`                            | 0-based nesting level                                                                                        |
| `module_item[new_tab]`                           | `ExternalTool` only                                                                                          |
| `module_item[completion_requirement][type]`      | `must_view`, `must_contribute`, `must_submit`, `min_score`, `must_mark_done`                                 |
| `module_item[completion_requirement][min_score]` | Required when type is `min_score`                                                                            |
| `module_item[iframe][width]` / `[height]`        | `ExternalTool` only                                                                                          |

Applicability of completion requirements: `must_view` — any type; `must_contribute` —
Assignment, Discussion, Page; `must_submit` / `min_score` — Assignment, Quiz;
`must_mark_done` — Assignment, Page. Inapplicable combinations are silently ignored, which
looks like the requirement "didn't save".

`PUT .../items/:id` adds **`module_item[published]`** and `module_item[module_id]` (move
between modules).

---

## Pages

`POST /courses/:course_id/pages`

| Parameter                     | Notes                                                        |
| ----------------------------- | ------------------------------------------------------------ |
| `wiki_page[title]`            | Determines the URL slug                                      |
| `wiki_page[body]`             | HTML                                                         |
| `wiki_page[published]`        |                                                              |
| `wiki_page[front_page]`       | Sets as course front page (page must be published)           |
| `wiki_page[editing_roles]`    | Comma-separated: `teachers`, `students`, `members`, `public` |
| `wiki_page[notify_of_update]` |                                                              |
| `wiki_page[todo_date]`        | Adds to student to-do list                                   |
| `wiki_page[publish_at]`       | Requires the Scheduled Page Publication feature              |

- `GET|PUT|DELETE /courses/:id/pages/:url_or_id` — `url_or_id` is the **slug** (or numeric id)
- `GET|PUT /courses/:id/front_page`
- `POST /courses/:id/pages/:url_or_id/duplicate`
- **Renaming a page changes its slug** and breaks module items and inline links pointing at
  the old one. The new slug comes back in the response — re-read it after any title change.

---

## Assignments

`POST /courses/:course_id/assignments` (created in the active state)

| Parameter                                                                     | Notes                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assignment[name]`                                                            | **Required**                                                                                                                                                       |
| `assignment[description]`                                                     | HTML                                                                                                                                                               |
| `assignment[submission_types][]`                                              | `online_text_entry`, `online_url`, `online_upload`, `media_recording`, `on_paper`, `none`, `discussion_topic`, `external_tool`, `not_graded`, `student_annotation` |
| `assignment[allowed_extensions][]`                                            | Only with `online_upload`                                                                                                                                          |
| `assignment[points_possible]`                                                 |                                                                                                                                                                    |
| `assignment[grading_type]`                                                    | `pass_fail`, `percent`, `letter_grade`, `gpa_scale`, `points`, `not_graded`                                                                                        |
| `assignment[assignment_group_id]`                                             |                                                                                                                                                                    |
| `assignment[due_at]`, `[unlock_at]`, `[lock_at]`                              | ISO8601                                                                                                                                                            |
| `assignment[published]`                                                       |                                                                                                                                                                    |
| `assignment[position]`                                                        | Within the group                                                                                                                                                   |
| `assignment[peer_reviews]`, `[automatic_peer_reviews]`, `[peer_review_count]` |                                                                                                                                                                    |
| `assignment[group_category_id]`                                               | Group assignment                                                                                                                                                   |
| `assignment[omit_from_final_grade]`                                           |                                                                                                                                                                    |
| `assignment[anonymous_grading]`, `[moderated_grading]`                        |                                                                                                                                                                    |
| `assignment[allowed_attempts]`                                                | `-1` for unlimited                                                                                                                                                 |
| `assignment[notify_of_update]`                                                | Emails students on change                                                                                                                                          |
| `assignment[external_tool_tag_attributes][url]`                               | With `submission_types[]=external_tool`                                                                                                                            |
| `assignment[integration_id]`, `[sis_assignment_id]`                           |                                                                                                                                                                    |

**Overrides** (differentiated due dates) — `POST /courses/:cid/assignments/:aid/overrides`
with exactly one of `assignment_override[student_ids][]`, `[group_id]`,
`[course_section_id]`, plus `[title]` and `[due_at]`. Send as JSON when creating several.

**Bulk date update** — `PUT /courses/:id/assignments/bulk_update` with a JSON array of
`{id, all_dates:[{base:true, due_at, unlock_at, lock_at}]}`.

---

## Discussions and announcements

`POST /courses/:course_id/discussion_topics` — note these are **not** nested under a wrapper.

| Parameter                                                 | Notes                                                     |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `title`, `message`                                        | `message` is HTML                                         |
| `discussion_type`                                         | `side_comment` (flat) or `threaded`                       |
| `published`                                               |                                                           |
| `delayed_post_at`, `lock_at`                              |                                                           |
| `podcast_enabled`, `podcast_has_student_posts`            |                                                           |
| `require_initial_post`                                    | Students must post before seeing replies                  |
| `pinned`, `position_after`                                |                                                           |
| `is_announcement`                                         | **`true` makes it an announcement**, same endpoint        |
| `assignment`                                              | Nested object makes it a graded discussion — send as JSON |
| `allow_rating`, `only_graders_can_rate`, `sort_by_rating` |                                                           |
| `attachment`                                              | Multipart file                                            |

Announcements are readable via `GET /announcements?context_codes[]=course_123`.

---

## Classic quizzes

**Quiz** — `POST /courses/:course_id/quizzes`

| Parameter                                                           | Notes                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| `quiz[title]`                                                       | **Required**                                             |
| `quiz[description]`                                                 | HTML                                                     |
| `quiz[quiz_type]`                                                   | `practice_quiz`, `assignment`, `graded_survey`, `survey` |
| `quiz[assignment_group_id]`                                         |                                                          |
| `quiz[time_limit]`                                                  | Minutes                                                  |
| `quiz[shuffle_answers]`, `[hide_results]`, `[show_correct_answers]` | `hide_results`: `always`, `until_after_last_attempt`     |
| `quiz[allowed_attempts]`                                            | `-1` unlimited                                           |
| `quiz[scoring_policy]`                                              | `keep_highest`, `keep_latest`                            |
| `quiz[one_question_at_a_time]`, `[cant_go_back]`                    |                                                          |
| `quiz[access_code]`, `[ip_filter]`                                  |                                                          |
| `quiz[due_at]`, `[lock_at]`, `[unlock_at]`                          |                                                          |
| `quiz[published]`                                                   |                                                          |
| `quiz[one_time_results]`, `[only_visible_to_overrides]`             |                                                          |

`points_possible` is derived from the questions — you do not set it directly on a graded quiz.

**Questions** — `POST /courses/:course_id/quizzes/:quiz_id/questions`. **Send as a JSON
body**; bracket-encoded `answers[][text]` arrays get mangled. Full question-type and answer
formats are in `content-types.md`.

**Question groups** (random draw) — `POST /courses/:cid/quizzes/:qid/groups` with
`quiz_groups[][name]`, `[pick_count]`, `[question_points]`.

**Reorder** — `POST /courses/:cid/quizzes/:qid/reorder` with `order[][id]` and `order[][type]`.

After adding questions to an already-published quiz, `PUT` the quiz with
`quiz[notify_of_update]=false` to force a re-save; otherwise `question_count` and
`points_possible` can lag.

---

## New Quizzes

A **different API** at `/api/quiz/v1/` (no `/api/v1`). New Quizzes are assignments under the
hood, so `:assignment_id` is used where you'd expect a quiz id. Only available on instances
where the feature is enabled.

- `POST /api/quiz/v1/courses/:course_id/quizzes` — `quiz[title]`, `quiz[assignment_group_id]`,
  `quiz[points_possible]`, `quiz[due_at]`, `quiz[grading_type]`, `quiz[instructions]`, and a
  `quiz[quiz_settings][...]` object (`calculator_type`, `shuffle_answers`,
  `shuffle_questions`, `one_at_a_time_type`, `allow_backtracking`, `has_time_limit`,
  `session_time_limit_in_seconds`, `require_student_access_code`, `student_access_code`,
  `filter_ip_address`, `result_view_settings`).
- `PATCH|GET|DELETE /api/quiz/v1/courses/:course_id/quizzes/:assignment_id`
- `POST /api/quiz/v1/courses/:course_id/quizzes/:assignment_id/items` — items carry
  `item[entry_type]=Item`, `item[points_possible]`, `item[position]`, and an `item[entry]`
  object with `title`, `item_body`, `interaction_type_slug`, `interaction_data`,
  `scoring_data`, `scoring_algorithm`, `feedback`. See `content-types.md`.

If a user wants New Quizzes and the endpoints 404, the feature flag is off on their instance
— Classic quizzes are the fallback, and content is not automatically portable between them.

---

## Files

Three-step upload (`recipes.md` has the worked example):

1. `POST /courses/:course_id/files` with `name`, `size`, `content_type`,
   `parent_folder_path` (or `parent_folder_id`), `on_duplicate` (`overwrite`|`rename`).
   Returns `upload_url` and `upload_params`.
2. `POST` multipart to `upload_url` with every `upload_params` key **in the order given**,
   `file` **last**.
3. Follow the returned redirect (`Location`) to finalise. Skipping this leaves the file
   invisible.

Alternative: pass `url=https://...` in step 1 and Canvas downloads it asynchronously; poll
`GET /files/:id` until `upload_status` is `success`.

Folders: `GET /courses/:id/folders`, `POST /courses/:id/folders` (`name`, `parent_folder_path`).
File metadata: `PUT /files/:id` (`name`, `locked`, `hidden`, `unlock_at`, `lock_at`).

---

## Enrollments and users

`POST /courses/:course_id/enrollments` (or `/sections/:section_id/enrollments`)

| Parameter                                        | Notes                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `enrollment[user_id]`                            | Numeric or `sis_user_id:X`                                                                           |
| `enrollment[type]`                               | `StudentEnrollment`, `TeacherEnrollment`, `TaEnrollment`, `ObserverEnrollment`, `DesignerEnrollment` |
| `enrollment[role_id]`                            | Custom role                                                                                          |
| `enrollment[enrollment_state]`                   | **`active` to skip the invitation**, else `invited`                                                  |
| `enrollment[course_section_id]`                  |                                                                                                      |
| `enrollment[notify]`                             | Default false — leave it false unless you mean to email people                                       |
| `enrollment[limit_privileges_to_course_section]` |                                                                                                      |
| `enrollment[associated_user_id]`                 | Observer linkage                                                                                     |

- `DELETE /courses/:cid/enrollments/:id?task=conclude|delete|deactivate`
- `GET /courses/:id/users?enrollment_type[]=student&per_page=100`
- Create users: `POST /accounts/:id/users` with `user[name]`, `pseudonym[unique_id]`,
  `pseudonym[sis_user_id]`, `pseudonym[password]`, `communication_channel[address]`,
  `communication_channel[skip_confirmation]=true`
- Find an existing user first: `GET /accounts/:id/users?search_term=...` — creating
  duplicates is much worse than failing to find one.
- Bulk: `POST /accounts/:id/bulk_enrollment` with `user_ids[]`, `course_ids[]`,
  `enrollment_type`.

---

## Content migrations

`POST /courses/:course_id/content_migrations`

| `migration_type`                                                                      | Settings                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `course_copy_importer`                                                                | `settings[source_course_id]`                                 |
| `common_cartridge_importer`                                                           | `pre_attachment[name]` + `pre_attachment[size]`, then upload |
| `canvas_cartridge_importer`, `moodle_converter`, `qti_converter`, `zip_file_importer` |                                                              |

Also: `date_shift_options[shift_dates]=true`, `[old_start_date]`, `[new_start_date]`,
`[old_end_date]`, `[new_end_date]`, `[remove_dates]`.

Selective import: `settings[import_type]` plus a second `PUT` with `copy[...]` after
`GET /courses/:id/content_migrations/:mid/selective_data`.

Poll `GET /courses/:id/content_migrations/:id` → `workflow_state` (`pre_processing`,
`running`, `completed`, `failed`) and follow `progress_url`.

`GET /api/v1/migration_issues` on the migration surfaces per-item warnings that are
otherwise invisible.

---

## Tabs and settings

- `GET /courses/:id/tabs` — course navigation items
- `PUT /courses/:id/tabs/:tab_id` — `position`, `hidden` (hide Quizzes, Files, etc.)
- `PUT /courses/:id/settings` — `hide_final_grades`, `allow_student_discussion_topics`,
  `allow_student_forum_attachments`, `restrict_student_past_view`,
  `restrict_student_future_view`, `syllabus_course_summary`
- Course image: `PUT /courses/:id` with `course[image_id]` (an uploaded file id) or
  `course[image_url]`
