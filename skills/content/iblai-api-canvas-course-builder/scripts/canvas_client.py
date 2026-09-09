"""Minimal Canvas LMS REST API client.

Covers the parts that are easy to get wrong: Link-header pagination, the leaky-bucket
throttle, Canvas's bracket-notation parameter encoding vs JSON bodies, and the three-step
file upload.

Usage:
    from canvas_client import CanvasClient, CanvasError

    c = CanvasClient()                      # reads CANVAS_API_URL / CANVAS_API_TOKEN
    me = c.get("/users/self")
    course = c.post("/accounts/1/courses", {"course": {"name": "Bio 101"}})
    for a in c.get_all(f"/courses/{course['id']}/assignments"):
        print(a["name"])

Requires: requests
"""

from __future__ import annotations

import mimetypes
import os
import re
import time
from typing import Any, Iterator
from urllib.parse import quote

import requests

DEFAULT_TIMEOUT = 60
MAX_RETRIES = 5
RETRY_STATUS = {429, 500, 502, 503, 504}


class CanvasError(RuntimeError):
    """A Canvas API request failed. Carries the status and parsed body."""

    def __init__(self, status: int, url: str, body: Any):
        self.status = status
        self.url = url
        self.body = body
        super().__init__(f"HTTP {status} for {url}: {_short(body)}")


def _short(body: Any, limit: int = 400) -> str:
    text = body if isinstance(body, str) else repr(body)
    return text if len(text) <= limit else text[:limit] + "..."


def flatten_params(obj: Any, prefix: str = "") -> list[tuple[str, str]]:
    """Convert nested dicts/lists into Canvas's bracket notation.

    {"course": {"name": "Bio", "public": True}} -> [("course[name]", "Bio"),
                                                    ("course[public]", "true")]
    {"ids": [1, 2]}                             -> [("ids[]", "1"), ("ids[]", "2")]

    Lists of dicts are intentionally NOT well served by this encoding (Canvas relies on
    Rails' positional grouping, which mangles objects sharing key sets). Send those as a
    JSON body instead -- see CanvasClient.post(..., as_json=True).
    """
    out: list[tuple[str, str]] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            nested = f"{prefix}[{key}]" if prefix else str(key)
            out.extend(flatten_params(value, nested))
    elif isinstance(obj, (list, tuple, set)):
        for value in obj:
            out.extend(flatten_params(value, f"{prefix}[]"))
    elif obj is None:
        pass  # omit; sending "" would clear the field instead of leaving it alone
    elif isinstance(obj, bool):
        out.append((prefix, "true" if obj else "false"))
    else:
        out.append((prefix, str(obj)))
    return out


def sis(kind: str, value: str) -> str:
    """Build a URL-safe SIS reference, e.g. sis("course", "BIO101-F26")."""
    return quote(f"sis_{kind}_id:{value}", safe="")


class CanvasClient:
    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        dry_run: bool = False,
        timeout: int = DEFAULT_TIMEOUT,
        verbose: bool = False,
    ):
        self.base_url = (base_url or os.environ.get("CANVAS_API_URL", "")).rstrip("/")
        token = token or os.environ.get("CANVAS_API_TOKEN", "")
        if not self.base_url or not token:
            raise SystemExit(
                "Set CANVAS_API_URL (e.g. https://school.instructure.com) and "
                "CANVAS_API_TOKEN in the environment."
            )
        self.dry_run = dry_run
        self.timeout = timeout
        self.verbose = verbose
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {token}"
        self.last_cost: float | None = None
        self.last_remaining: float | None = None

    # -- core ---------------------------------------------------------------

    def _url(self, path: str) -> str:
        if path.startswith("http"):
            return path
        if not path.startswith("/api/"):
            path = "/api/v1" + ("" if path.startswith("/") else "/") + path
        return self.base_url + path

    def request(
        self,
        method: str,
        path: str,
        params: dict | None = None,
        data: dict | None = None,
        as_json: bool = False,
        files: Any = None,
        raw: bool = False,
    ) -> Any:
        """Issue one request, retrying on throttling and transient 5xx."""
        url = self._url(path)
        writing = method.upper() not in ("GET", "HEAD")

        if self.dry_run and writing:
            print(f"[dry-run] {method.upper()} {url} {_short(data, 200)}")
            return {
                "id": f"dry-run-{abs(hash((method, url, str(data)))) % 10**6}",
                "dry_run": True,
            }

        kwargs: dict[str, Any] = {"timeout": self.timeout}
        if params:
            kwargs["params"] = flatten_params(params)
        if files is not None:
            kwargs["files"] = files
            if data:
                kwargs["data"] = data
        elif data is not None:
            if as_json:
                kwargs["json"] = data
            else:
                kwargs["data"] = flatten_params(data)

        delay = 2.0
        for attempt in range(MAX_RETRIES):
            try:
                resp = self.session.request(method, url, **kwargs)
            except requests.RequestException as exc:
                if attempt == MAX_RETRIES - 1:
                    raise SystemExit(
                        f"Could not reach {url}: {exc.__class__.__name__}. "
                        "Check CANVAS_API_URL and network access."
                    ) from exc
                time.sleep(delay)
                delay *= 2
                continue
            self._record_cost(resp)

            if self._is_throttled(resp) or resp.status_code in RETRY_STATUS:
                if attempt == MAX_RETRIES - 1:
                    break
                if self.verbose:
                    print(f"  retrying after {delay:.0f}s (HTTP {resp.status_code})")
                time.sleep(delay)
                delay *= 2
                continue

            if resp.status_code >= 400:
                raise CanvasError(resp.status_code, url, _body(resp))
            if raw:
                return resp
            return _body(resp)

        raise CanvasError(resp.status_code, url, _body(resp))

    def _record_cost(self, resp: requests.Response) -> None:
        try:
            if "X-Request-Cost" in resp.headers:
                self.last_cost = float(resp.headers["X-Request-Cost"])
            if "X-Rate-Limit-Remaining" in resp.headers:
                self.last_remaining = float(resp.headers["X-Rate-Limit-Remaining"])
        except ValueError:
            pass

    @staticmethod
    def _is_throttled(resp: requests.Response) -> bool:
        # Canvas returns 403 (older) or 429 (newer) with this phrase in the body.
        # A plain 403 is a permissions problem and must NOT be retried.
        if resp.status_code not in (403, 429):
            return False
        return "rate limit exceeded" in (resp.text or "").lower()

    # -- verbs --------------------------------------------------------------

    def get(self, path: str, **params) -> Any:
        return self.request("GET", path, params=params or None)

    def post(self, path: str, data: dict | None = None, as_json: bool = False) -> Any:
        return self.request("POST", path, data=data, as_json=as_json)

    def put(self, path: str, data: dict | None = None, as_json: bool = False) -> Any:
        return self.request("PUT", path, data=data, as_json=as_json)

    def delete(self, path: str, data: dict | None = None) -> Any:
        return self.request("DELETE", path, data=data)

    # -- pagination ---------------------------------------------------------

    def paginate(self, path: str, **params) -> Iterator[dict]:
        """Yield every item across all pages, following the Link header.

        Never build page URLs yourself -- some endpoints use bookmark cursors.
        """
        params.setdefault("per_page", 100)
        url: str | None = self._url(path)
        query: dict | None = params
        while url:
            resp = self.request("GET", url, params=query, raw=True)
            payload = _body(resp)
            if isinstance(payload, dict):
                # A few endpoints wrap the list, e.g. {"quiz_submissions": [...]}
                lists = [v for v in payload.values() if isinstance(v, list)]
                payload = lists[0] if len(lists) == 1 else [payload]
            yield from payload
            url = _next_link(resp.headers.get("Link", ""))
            query = None  # the next URL already carries the query string

    def get_all(self, path: str, **params) -> list[dict]:
        return list(self.paginate(path, **params))

    # -- files --------------------------------------------------------------

    def upload_file(self, local_path: str, endpoint: str, **extra) -> dict:
        """Three-step Canvas file upload.

        endpoint is where the file belongs, e.g. f"/courses/{cid}/files".
        extra accepts parent_folder_path, name, on_duplicate ("overwrite"/"rename"), etc.
        Returns the created attachment (with its id and url).
        """
        name = extra.pop("name", os.path.basename(local_path))
        size = os.path.getsize(local_path)
        content_type = (
            extra.pop("content_type", None)
            or mimetypes.guess_type(name)[0]
            or "application/octet-stream"
        )

        # Step 1: tell Canvas about the upload and get a target URL + opaque params.
        init = self.post(
            endpoint,
            {"name": name, "size": size, "content_type": content_type, **extra},
        )
        if self.dry_run:
            return init

        if not isinstance(init, dict) or "upload_url" not in init:
            raise CanvasError(
                200,
                endpoint,
                f"Upload step 1 returned no upload_url (got {_short(init, 200)}). "
                "Check the token has file-upload rights on this course.",
            )
        upload_url = init["upload_url"]
        upload_params = init.get("upload_params", {})

        # Step 2: POST the params *in the order given*, with the file field LAST.
        # Some storage backends (S3) reject the upload otherwise.
        with open(local_path, "rb") as fh:
            fields = [(k, (None, str(v))) for k, v in upload_params.items()]
            fields.append(("file", (name, fh, content_type)))
            resp = requests.post(
                upload_url, files=fields, timeout=self.timeout, allow_redirects=False
            )

        if resp.status_code >= 400:
            raise CanvasError(resp.status_code, upload_url, _body(resp))

        # Step 3: follow the redirect to finalise, or read the inline result.
        location = resp.headers.get("Location")
        if location:
            return self.request("GET", location)
        return _body(resp)


# -- helpers ---------------------------------------------------------------


def _body(resp: requests.Response) -> Any:
    if not resp.content:
        return None
    try:
        return resp.json()
    except ValueError:
        # Canvas prefixes some JSON responses with while(1); as an anti-hijack measure.
        text = resp.text.lstrip()
        if text.startswith("while(1);"):
            import json

            return json.loads(text[len("while(1);") :])
        return resp.text


def _next_link(link_header: str) -> str | None:
    for part in link_header.split(","):
        match = re.match(r'\s*<([^>]+)>\s*;\s*rel="?next"?', part)
        if match:
            return match.group(1)
    return None


if __name__ == "__main__":
    client = CanvasClient()
    user = client.get("/users/self")
    print(f"Authenticated as {user.get('name')} (id {user.get('id')})")
    accounts = client.get_all("/accounts")
    if accounts:
        print("Accounts you can administer:")
        for account in accounts:
            print(f"  {account['id']:>8}  {account['name']}")
    else:
        print(
            "No admin accounts -- this token can populate courses but not create them."
        )
