#!/usr/bin/env python3
"""Build a Canvas course from a YAML/JSON spec, in dependency order, idempotently.

    python build_course.py course.yaml --account 1 --dry-run
    python build_course.py course.yaml --account 1
    python build_course.py course.yaml --course 12345      # populate an existing course

Idempotency: every created object is recorded in a manifest (default
<spec>.manifest.json) keyed by its spec name. Re-running updates those objects instead of
creating duplicates. Delete the manifest only if you want a fresh course.

Nothing is published unless the spec says so, and the course itself is published only with
--publish (or `course.publish: true` in the spec). See assets/course_spec.example.yaml.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from canvas_client import CanvasClient, CanvasError  # noqa: E402

# -- manifest ---------------------------------------------------------------


class Manifest:
    """Maps spec names -> Canvas IDs so re-runs update rather than duplicate."""

    def __init__(self, path: Path, read_only: bool = False):
        self.path = path
        self.read_only = read_only  # dry runs must not poison the real manifest
        self.data: dict = json.loads(path.read_text()) if path.exists() else {}

    def get(self, kind: str, name: str):
        return self.data.get(kind, {}).get(name)

    def set(self, kind: str, name: str, value) -> None:
        self.data.setdefault(kind, {})[name] = value
        if not self.read_only:
            self.path.write_text(json.dumps(self.data, indent=2, sort_keys=True))

    def __contains__(self, item) -> bool:
        kind, name = item
        return self.get(kind, name) is not None


# -- builder ----------------------------------------------------------------


class CourseBuilder:
    def __init__(self, client: CanvasClient, spec: dict, manifest: Manifest):
        self.c = client
        self.spec = spec
        self.m = manifest
        self.course_id = None
        self.groups: dict[str, int] = {}  # assignment group name -> id
        self.pages: dict[str, str] = {}  # page title -> url slug
        self.content: dict[str, dict] = {}  # ("Assignment", title) -> id, etc.
        self.counts: dict[str, int] = {}

    def log(self, kind: str, action: str, name: str) -> None:
        self.counts[kind] = self.counts.get(kind, 0) + 1
        print(f"  {action:<8} {kind:<16} {name}")

    # -- 1. course shell ----------------------------------------------------

    def ensure_course(self, account_id: str | None, existing: str | None) -> None:
        if existing:
            self.course_id = existing
            course = self.c.get(f"/courses/{existing}")
            print(f"Using existing course {existing}: {course.get('name')}")
            return

        known = self.m.get("course", "id")
        if known:
            self.course_id = known
            print(f"Reusing course {known} from manifest")
            self.c.put(f"/courses/{known}", {"course": self._course_fields()})
            return

        if not account_id:
            raise SystemExit(
                "Pass --account <id> to create a course, or --course <id>."
            )

        payload = {"course": self._course_fields()}
        payload.update(self._top_level_fields())
        payload.setdefault("offer", False)
        course = self.c.post(f"/accounts/{account_id}/courses", payload)
        self.course_id = course["id"]
        self.m.set("course", "id", self.course_id)
        print(f"Created course {self.course_id}: {course.get('name')}")

    # These live at the top level of the request, NOT under course[...].
    TOP_LEVEL = {
        "offer",
        "enroll_me",
        "skip_course_template",
        "enable_sis_reactivation",
    }

    # Everything Canvas accepts under course[...] on create.
    COURSE_FIELDS = {
        "name",
        "course_code",
        "start_at",
        "end_at",
        "license",
        "is_public",
        "is_public_to_auth_users",
        "public_syllabus",
        "public_syllabus_to_auth",
        "public_description",
        "allow_student_wiki_edits",
        "allow_wiki_comments",
        "allow_student_forum_attachments",
        "open_enrollment",
        "self_enrollment",
        "restrict_enrollments_to_course_dates",
        "term_id",
        "sis_course_id",
        "integration_id",
        "hide_final_grades",
        "apply_assignment_group_weights",
        "time_zone",
        "default_view",
        "syllabus_body",
        "grading_standard_id",
        "grade_passback_setting",
        "course_format",
        "post_manually",
    }

    def _top_level_fields(self) -> dict:
        spec = self.spec.get("course", {})
        return {k: v for k, v in spec.items() if k in self.TOP_LEVEL}

    def _course_fields(self) -> dict:
        spec = dict(self.spec.get("course", {}))
        for builder_only in ("publish", "front_page"):
            spec.pop(builder_only, None)
        for top_level in self.TOP_LEVEL:
            spec.pop(top_level, None)

        # Canvas silently ignores start_at/end_at unless this flag is set. Without
        # the warning you get a course with no dates and no error to explain it.
        has_dates = spec.get("start_at") or spec.get("end_at")
        if has_dates and not spec.get("restrict_enrollments_to_course_dates"):
            print(
                "  WARNING: start_at/end_at are ignored by Canvas unless "
                "restrict_enrollments_to_course_dates is true. Setting it."
            )
            spec["restrict_enrollments_to_course_dates"] = True

        unknown = set(spec) - self.COURSE_FIELDS
        if unknown:
            print(f"  note: ignoring unrecognised course fields: {sorted(unknown)}")
        return {k: v for k, v in spec.items() if k in self.COURSE_FIELDS}

    # -- 2. sections --------------------------------------------------------

    def build_sections(self) -> None:
        for item in self.spec.get("sections", []):
            name = item["name"]
            existing = self.m.get("sections", name)
            if existing:
                self.log("section", "skip", name)
                continue
            created = self.c.post(
                f"/courses/{self.course_id}/sections", {"course_section": item}
            )
            self.m.set("sections", name, created["id"])
            self.log("section", "created", name)

    # -- 3. assignment groups ----------------------------------------------

    def build_assignment_groups(self) -> None:
        for item in self.spec.get("assignment_groups", []):
            name = item["name"]
            existing = self.m.get("assignment_groups", name)
            if existing:
                self.groups[name] = existing
                self.log("group", "skip", name)
                continue
            created = self.c.post(f"/courses/{self.course_id}/assignment_groups", item)
            self.groups[name] = created["id"]
            self.m.set("assignment_groups", name, created["id"])
            self.log("group", "created", name)

    # -- 4. files -----------------------------------------------------------

    def build_files(self, spec_dir: Path) -> None:
        for item in self.spec.get("files", []):
            local = (spec_dir / item["path"]).resolve()
            name = item.get("name", local.name)
            if not local.exists():
                print(f"  MISSING  file             {local}")
                continue
            if self.m.get("files", name):
                self.log("file", "skip", name)
                continue
            extra = {"on_duplicate": item.get("on_duplicate", "overwrite")}
            if item.get("folder"):
                extra["parent_folder_path"] = item["folder"]
            uploaded = self.c.upload_file(
                str(local), f"/courses/{self.course_id}/files", name=name, **extra
            )
            file_id = uploaded.get("id")
            self.m.set("files", name, file_id)
            # Referenceable from a module item by either the file name or the spec path.
            self.content[f"File::{name}"] = file_id
            self.content[f"File::{item['path']}"] = file_id
            self.log("file", "uploaded", name)

    # -- 5. content ---------------------------------------------------------

    def build_pages(self) -> None:
        for item in self.spec.get("pages", []):
            title = item["title"]
            payload = {"wiki_page": item}
            existing = self.m.get("pages", title)
            if existing:
                page = self.c.put(
                    f"/courses/{self.course_id}/pages/{existing}", payload
                )
                action = "updated"
            else:
                page = self.c.post(f"/courses/{self.course_id}/pages", payload)
                action = "created"
            # Module items reference pages by url slug, never by id.
            slug = page.get("url") or existing or _slugify(title)
            self.pages[title] = slug
            self.m.set("pages", title, slug)
            self.log("page", action, title)

    def build_assignments(self) -> None:
        for item in self.spec.get("assignments", []):
            item = dict(item)
            name = item["name"]
            group = item.pop("assignment_group", None)
            if group:
                if group not in self.groups:
                    raise SystemExit(
                        f"Assignment '{name}' references unknown group '{group}'"
                    )
                item["assignment_group_id"] = self.groups[group]
            existing = self.m.get("assignments", name)
            if existing:
                created = self.c.put(
                    f"/courses/{self.course_id}/assignments/{existing}",
                    {"assignment": item},
                )
                action = "updated"
                created = {"id": existing}
            else:
                created = self.c.post(
                    f"/courses/{self.course_id}/assignments", {"assignment": item}
                )
                action = "created"
                self.m.set("assignments", name, created["id"])
            self.content[f"Assignment::{name}"] = created["id"]
            self.log("assignment", action, name)

    def build_discussions(self) -> None:
        for item in self.spec.get("discussions", []):
            title = item["title"]
            existing = self.m.get("discussions", title)
            if existing:
                created = self.c.put(
                    f"/courses/{self.course_id}/discussion_topics/{existing}", item
                )
                action = "updated"
                created = {"id": existing}
            else:
                created = self.c.post(
                    f"/courses/{self.course_id}/discussion_topics", item
                )
                action = "created"
                self.m.set("discussions", title, created["id"])
            self.content[f"Discussion::{title}"] = created["id"]
            self.log("discussion", action, title)

    def build_quizzes(self) -> None:
        for item in self.spec.get("quizzes", []):
            item = dict(item)
            title = item["title"]
            questions = item.pop("questions", [])
            group = item.pop("assignment_group", None)
            if group:
                if group not in self.groups:
                    raise SystemExit(
                        f"Quiz '{title}' references unknown group '{group}'"
                    )
                item["assignment_group_id"] = self.groups[group]
            existing = self.m.get("quizzes", title)
            if existing:
                quiz = self.c.put(
                    f"/courses/{self.course_id}/quizzes/{existing}", {"quiz": item}
                )
                action = "updated"
                quiz = {"id": existing}
            else:
                quiz = self.c.post(f"/courses/{self.course_id}/quizzes", {"quiz": item})
                action = "created"
                self.m.set("quizzes", title, quiz["id"])
            quiz_id = quiz["id"]
            self.content[f"Quiz::{title}"] = quiz_id
            self.log("quiz", action, title)

            # Questions are only created once -- editing them in place by index is
            # unreliable, so re-runs leave existing questions alone.
            if self.m.get("quiz_questions", title):
                continue
            for position, question in enumerate(questions, start=1):
                question = dict(question)
                question.setdefault("position", position)
                question.setdefault("question_name", f"Question {position}")
                # JSON body: bracket-encoded arrays of answer objects get mangled.
                self.c.post(
                    f"/courses/{self.course_id}/quizzes/{quiz_id}/questions",
                    {"question": question},
                    as_json=True,
                )
                self.log("quiz question", "created", f"{title} / Q{position}")
            if questions:
                self.m.set("quiz_questions", title, len(questions))

    # -- 6/7. modules and items --------------------------------------------

    def build_modules(self) -> None:
        for position, module in enumerate(self.spec.get("modules", []), start=1):
            name = module["name"]
            fields = {
                k: v
                for k, v in module.items()
                if k
                in {
                    "name",
                    "unlock_at",
                    "require_sequential_progress",
                    "publish_final_grade",
                }
            }
            fields["position"] = module.get("position", position)
            existing = self.m.get("modules", name)
            if existing:
                created = self.c.put(
                    f"/courses/{self.course_id}/modules/{existing}", {"module": fields}
                )
                action = "updated"
                created = {"id": existing}
            else:
                created = self.c.post(
                    f"/courses/{self.course_id}/modules", {"module": fields}
                )
                action = "created"
                self.m.set("modules", name, created["id"])
            module_id = created["id"]
            self.log("module", action, name)
            self._build_module_items(module_id, name, module.get("items", []))

    def _build_module_items(self, module_id, module_name: str, items: list) -> None:
        for position, item in enumerate(items, start=1):
            item = dict(item)
            item_type = item.pop("type")
            title = item.pop("title", None)
            key = f"{module_name}::{position}::{item_type}::{title}"
            if self.m.get("module_items", key):
                continue

            payload = {"type": item_type, "position": position}
            if title:
                payload["title"] = title
            for field in (
                "indent",
                "new_tab",
                "external_url",
                "completion_requirement",
            ):
                if field in item:
                    payload[field] = item[field]

            if item_type == "Page":
                slug = self.pages.get(title) or item.get("page_url")
                if not slug:
                    raise SystemExit(
                        f"Module item '{title}' is a Page but no page with that title "
                        f"was created and no page_url was given."
                    )
                payload["page_url"] = slug
            elif item_type in (
                "Assignment",
                "Quiz",
                "Discussion",
                "File",
                "ExternalTool",
            ):
                content_id = item.get("content_id") or self.content.get(
                    f"{item_type}::{title}"
                )
                if not content_id:
                    raise SystemExit(
                        f"Module item '{title}' ({item_type}) has no matching content. "
                        f"Create it in the spec first or give an explicit content_id."
                    )
                payload["content_id"] = content_id
            elif item_type == "ExternalUrl" and not payload.get("external_url"):
                raise SystemExit(f"ExternalUrl item '{title}' needs an external_url.")

            created = self.c.post(
                f"/courses/{self.course_id}/modules/{module_id}/items",
                {"module_item": payload},
                # completion_requirement is a nested object; JSON keeps it intact
                as_json="completion_requirement" in payload,
            )
            self.m.set("module_items", key, created.get("id"))
            self.log("module item", "created", f"{module_name} / {title or item_type}")

    # -- 8. front page and syllabus ----------------------------------------

    def set_front_page(self) -> None:
        title = self.spec.get("course", {}).get("front_page")
        if not title:
            return
        slug = self.pages.get(title)
        if not slug:
            print(f"  note: front_page '{title}' is not among the created pages")
            return
        self.c.put(
            f"/courses/{self.course_id}/pages/{slug}",
            {"wiki_page": {"front_page": True, "published": True}},
        )
        self.c.put(f"/courses/{self.course_id}", {"course": {"default_view": "wiki"}})
        self.log("front page", "set", title)

    # -- 9. enrollments -----------------------------------------------------

    def build_enrollments(self) -> None:
        for item in self.spec.get("enrollments", []):
            item = dict(item)
            user_ref = item.pop("user_id", None)
            if item.get("user_sis_id"):
                user_ref = f"sis_user_id:{item.pop('user_sis_id')}"
            if not user_ref:
                print("  note: enrollment entry with no user_id/user_sis_id, skipping")
                continue
            key = f"{user_ref}::{item.get('type', 'StudentEnrollment')}"
            if self.m.get("enrollments", key):
                continue
            section = item.pop("section", None)
            payload = {
                "user_id": user_ref,
                "type": item.get("type", "StudentEnrollment"),
                # Without this the user gets an invitation they must accept.
                "enrollment_state": item.get("enrollment_state", "active"),
                "notify": item.get("notify", False),
            }
            if section:
                section_id = self.m.get("sections", section)
                path = f"/sections/{section_id}/enrollments"
            else:
                path = f"/courses/{self.course_id}/enrollments"
            created = self.c.post(path, {"enrollment": payload})
            self.m.set("enrollments", key, created.get("id"))
            self.log("enrollment", "created", key)

    # -- 10. publish --------------------------------------------------------

    def publish(self, publish_course: bool) -> None:
        for module in self.spec.get("modules", []):
            if not module.get("published"):
                continue
            module_id = self.m.get("modules", module["name"])
            self.c.put(
                f"/courses/{self.course_id}/modules/{module_id}",
                {"module": {"published": True}},
            )
            self.log("published module", "publish", module["name"])
        if publish_course:
            self.c.put(f"/courses/{self.course_id}", {"course": {"event": "offer"}})
            print("  COURSE PUBLISHED -- it is now visible to enrolled students.")


def _slugify(title: str) -> str:
    return "-".join(
        "".join(ch if ch.isalnum() else " " for ch in title).lower().split()
    )


def load_spec(path: Path) -> dict:
    text = path.read_text()
    if path.suffix in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError:
            raise SystemExit("pip install pyyaml, or convert the spec to JSON.")
        return yaml.safe_load(text)
    return json.loads(text)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path)
    parser.add_argument("--account", help="account id to create the course in")
    parser.add_argument("--course", help="populate this existing course instead")
    parser.add_argument("--manifest", type=Path, help="default: <spec>.manifest.json")
    parser.add_argument(
        "--publish",
        action="store_true",
        help="publish the course at the end (overrides the spec)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="print writes without performing them"
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    spec = load_spec(args.spec)
    manifest_path = args.manifest or args.spec.with_suffix(
        args.spec.suffix + ".manifest.json"
    )
    manifest = Manifest(manifest_path, read_only=args.dry_run)
    client = CanvasClient(dry_run=args.dry_run, verbose=args.verbose)

    who = client.get("/users/self")
    print(f"Authenticated as {who.get('name')} (id {who.get('id')})")
    if args.dry_run:
        print("DRY RUN -- no writes will be performed.\n")

    builder = CourseBuilder(client, spec, manifest)
    try:
        builder.ensure_course(args.account, args.course)
        builder.build_sections()
        builder.build_assignment_groups()
        builder.build_files(args.spec.parent)
        builder.build_pages()
        builder.build_assignments()
        builder.build_discussions()
        builder.build_quizzes()
        builder.build_modules()
        builder.set_front_page()
        builder.build_enrollments()
        builder.publish(args.publish or spec.get("course", {}).get("publish", False))
    except CanvasError as exc:
        print(f"\nFAILED: {exc}", file=sys.stderr)
        print(
            f"Manifest saved at {manifest_path} -- fix the cause and re-run to resume.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    base = os.environ.get("CANVAS_API_URL", "").rstrip("/")
    print(f"\nCourse {builder.course_id}: {base}/courses/{builder.course_id}")
    for kind, count in sorted(builder.counts.items()):
        print(f"  {count:>4}  {kind}")
    print(f"Manifest: {manifest_path}")
    if not (args.publish or spec.get("course", {}).get("publish", False)):
        print("Course is UNPUBLISHED. To publish:")
        print(
            f"  curl -X PUT '{base}/api/v1/courses/{builder.course_id}' "
            f"-H \"Authorization: Bearer $CANVAS_API_TOKEN\" -d 'course[event]=offer'"
        )


if __name__ == "__main__":
    main()
