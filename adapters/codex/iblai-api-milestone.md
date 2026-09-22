# iblai-api-milestone

> Read and write an ibl.ai organization's catalog milestones via the platform API — course, resource, program, and pathway completions, plus skill points at block, course, platform, and user level (including bulk and group updates). Use when querying or recording user progress and skill-point totals.

# iblai-api-milestone

Read and write an organization's **catalog milestones**: completion records for
courses, resources, programs, and pathways, and skill points scoped to a block,
a course, the platform, or a user (with bulk and group updates). Use when
querying or recording user progress and skill-point totals.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the
  `/api/catalog/milestones/…` paths below are appended to it (e.g.
  `https://api.iblai.app/dm/api/catalog/milestones/completions/course/manage/`).
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (a.k.a. `platform_key`),
  `{username}` = `$IBLAI_USERNAME`.
- DELETE is destructive — **confirm with the user first.**
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Completions

#### Course

- **GET** `/api/catalog/milestones/completions/course/manage/` — retrieve one course completion. Params: `course_id`, `user_id`. Returns `completion_percentage`, `completed`, `completion_date`, `completion_data`, grading fields.
- **GET** `/api/catalog/milestones/completions/course/catalog/` — all course completions for one user, keyed by course id. Params: `user_id`; optional `field_key` (e.g. `completion_percentage`, `completion_data`) returns just that field per course.

#### Resource

- **GET** `/api/catalog/milestones/completions/resource/manage/` — retrieve one resource completion. Params: `resource_id`, `user_id`. Returns `resource_type`, `completion_percentage`, `completed`, `completion_data`.

#### Program

- **GET** `/api/catalog/milestones/completions/program/query/` — query a user's program completion. Params: `program_key` (required, urlencoded), and one of `user_id`/`username`. Returns `{ "count", "completion_percentage" }` (`completion_percentage` is 0.0–1.0).

#### Pathway

- **GET** `/api/catalog/milestones/completions/pathway/query/` — query a user's pathway completion. Params: `pathway_uuid` (required), and one of `user_id`/`username`. Returns `{ "count", "completion_percentage" }` (`completion_percentage` is 0.0–1.0).

### Skill points

#### Block

- **GET** `/api/catalog/milestones/skill_points/block/` — skill points for a block. Param: `block_id` (URL-encoded). Returns a `{ skill: points }` map.

#### Course

- **GET** `/api/catalog/milestones/skill_points/course/` — skill points for a course. Param: `course_id` (URL-encoded). Returns a `{ skill: points }` map.

#### Platform

- **GET** `/api/catalog/milestones/skill_points/platform/` — list platform skill-point records. Params: `platform_key` (or `platform_org`) required; optional `query`, `sort` (default `-id`). Returns a paginated `{ count, next_page, previous_page, results[] }`, each result carrying `username`, `skill`, `skill_id`, `skill_points`.

#### User

- **GET** `/api/catalog/milestones/skill_points/user/` — aggregated skill points for one user. Params: `user_id`/`username`. Returns a `{ skill: { course_points, block_points, platform_points, total_points } }` map.

## Writes

### Completions

#### Course

- **POST** `/api/catalog/milestones/completions/course/manage/` — create/update a course completion. Body accepts `course_id`, `user_id`, and any `CourseCompletion` field:
  ```json
  { "course_id": "course-v1:edX+DemoX+Demo_Course", "user_id": 42, "completed": true, "completion_percentage": 95.3 }
  ```

#### Resource

- **POST** `/api/catalog/milestones/completions/resource/manage/` — create/update a resource completion. Body: `resource_id` (int, required), `user_id` (int, required), optional `completed`, `completion_percentage` (0.0–1.0), `completion_date`, `completion_data`:
  ```json
  { "resource_id": 11, "user_id": 42, "completed": true, "completion_percentage": 1.0 }
  ```

### Skill points

#### Block

- **POST** `/api/catalog/milestones/skill_points/block/` — set a block's skill points:
  ```json
  { "block_id": "block-v1:test+test+test+type@html+block@2d68d2674abb47b5b676e822741acc25", "point_data": { "test-skill": 4.5, "another-skill": 6.2 } }
  ```

#### Course

- **POST** `/api/catalog/milestones/skill_points/course/` — set a course's skill points:
  ```json
  { "course_id": "course-v1:test+test+test", "point_data": { "test-skill": 63.0, "another-skill": 45.0 } }
  ```

#### Platform

- **POST** `/api/catalog/milestones/skill_points/platform/` — update a user's platform skill points. Body: `username`, `platform_key`, `point_data`, optional `overwrite` (default `true`):
  ```json
  { "username": "student1", "platform_key": "test-platform", "point_data": { "test-skill": 63.0, "another-skill": 45.0 }, "overwrite": false }
  ```
- **DELETE** `/api/catalog/milestones/skill_points/platform/` — delete one platform skill-point record. Params: `skill_point_id` (required), `platform_key` (or `platform_org`). Destructive — **confirm with the user first.**
- **POST** `/api/catalog/milestones/skill_points/platform/bulk/` — bulk update platform skill points (platform-admin access). Body: `skill_point_data` (required; array of per-user entries — each entry takes `username`/`user_id`, `point_data`, optional `overwrite`), optional top-level `platform_key` applied to every entry:
  ```json
  { "platform_key": "test-platform", "skill_point_data": [ { "username": "student1", "point_data": { "test-skill": 63.0 }, "overwrite": false }, { "user_id": 7, "point_data": { "skill-1": 31.0 }, "overwrite": false } ] }
  ```
- **POST** `/api/catalog/milestones/skill_points/platform/group/` — update platform skill points for a group. Body: `group_id`, `platform_key`, `point_data`, optional `overwrite`:
  ```json
  { "group_id": 123, "platform_key": "test-platform", "point_data": { "test-skill": 63.0, "another-skill": 45.0 }, "overwrite": false }
  ```

## Example

Look up a user's course completion:

```bash
curl -G \
  "https://api.iblai.app/dm/api/catalog/milestones/completions/course/manage/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  --data-urlencode "course_id=course-v1:edX+DemoX+Demo_Course" \
  --data-urlencode "user_id=10"
```

## Notes

- **Id formats:** course ids are opaque keys like `course-v1:edX+DemoX+Demo_Course`;
  block ids like `block-v1:test+test+test+type@html+block@<hash>`; program keys
  like `program-v1:main+test`; pathways use a UUID (`pathway_uuid`). URL-encode
  these in query strings (`:` → `%3A`, `+` → `%2B`, `@` → `%40`).
- **`platform_key`** is the org key (`$IBLAI_ORG`) on the wire for skill-point
  operations.
- **`overwrite`** (default `true`) on platform/bulk/group updates replaces the
  user's existing points for the given skills; set `false` to merge/add.
- The course `catalog/` read returns *all* of a single user's course
  completions at once; pass `field_key` to slice out one field per course.
- Platform bulk updates require platform-admin level access.