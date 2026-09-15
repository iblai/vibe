#!/usr/bin/env python3
"""Reconcile a course spec against the live Studio outline (idempotent bulk edits).

    python3 reconcile.py spec.json --course course-v1:ORG+NUM+RUN [--env studio.env]
                         [--apply] [--delete] [--publish] [--map build.json]

Default is a dry run that prints the plan. --apply creates/updates/reorders,
--delete also removes live blocks absent from the spec, --publish publishes every
unit that changed. The spec has the create_full_course shape (section[] →
subsection[] → unit[] → problems[]); nodes are matched to live blocks by "id"
(a locator, when given) else by name at the same level. Components are matched
by (type, display_name). Supported problem_type: html, blank, multiplechoice,
dropdown, video. Standard library only.
"""
import argparse, json, re, sys, urllib.parse, urllib.request

CATEGORY = {"html": "html", "blank": "problem", "multiplechoice": "problem", "dropdown": "problem", "video": "video"}


def load_env(path):
    env = {}
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^([A-Z_]+)=(.*)$", line)
        if m:
            env[m[1]] = m[2].strip().strip("'")  # values are single-quoted; strip them
    for k in ("STUDIO_URL", "STUDIO_SESSION", "STUDIO_CSRF"):
        if not env.get(k):
            sys.exit(f"{path}: {k} missing — run /iblai-api-studio-auth")
    return env


class Studio:
    def __init__(self, env):
        self.base = env["STUDIO_URL"].rstrip("/")
        self.headers = {
            "Cookie": f"studio_session_id={env['STUDIO_SESSION']}; csrftoken={env['STUDIO_CSRF']}",
            "X-CSRFToken": env["STUDIO_CSRF"], "Origin": self.base, "Referer": self.base + "/",
            "Accept": "application/json", "Content-Type": "application/json",
        }
        self.calls = 0

    def req(self, method, path, body=None):
        self.calls += 1
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(self.base + path, data=data, method=method, headers=self.headers)
        try:
            with urllib.request.urlopen(r) as resp:
                text = resp.read().decode()
                return json.loads(text) if text.strip().startswith(("{", "[")) else {}
        except urllib.error.HTTPError as e:
            snippet = e.read().decode(errors="replace")[:200].replace("\n", " ")
            sys.exit(f"{method} {path} → {e.code}: {snippet}  (302/403/500 usually = session; see /iblai-api-studio-auth)")

    def outline(self, root):
        return self.req("GET", f"/xblock/outline/{root}")

    def units(self, course):
        return self.req("GET", f"/api/v1/ibl/course/{course}/units")["units"]

    def block(self, locator):
        return self.req("GET", f"/xblock/{locator}")

    def create(self, parent, category, name):
        return self.req("POST", "/xblock/", {"parent_locator": parent, "category": category, "display_name": name})["locator"]

    def update(self, locator, body):
        return self.req("POST", f"/xblock/{locator}", body)

    def delete(self, locator):
        return self.req("DELETE", f"/xblock/{locator}")


def children(node):
    return (node.get("child_info") or {}).get("children", [])


def match(spec_items, live_items, name_of):
    """Pair spec items with live items by id, then by name; return [(spec, live|None)] + unmatched live."""
    live_left = list(live_items)
    pairs = []
    for s in spec_items:
        hit = None
        if s.get("id"):
            hit = next((l for l in live_left if l["id"] == s["id"]), None)
        if hit is None:
            hit = next((l for l in live_left if name_of(l) == s["name"]), None)
        if hit is not None:
            live_left.remove(hit)
        pairs.append((s, hit))
    return pairs, live_left


def component_body(p):
    """Update body for a component from its spec entry."""
    meta = dict(p.get("metadata") or {})
    meta["display_name"] = p.get("display_name") or meta.get("display_name") or p["name"]
    body = {"metadata": meta}
    if p["problem_type"] == "html":
        body["data"] = p["data"]
    elif p["problem_type"] == "video":
        pass
    else:
        body["data"] = p["data"]
        body["nullout"] = ["markdown"]
        meta.pop("markdown", None)
    return body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec"); ap.add_argument("--course", required=True); ap.add_argument("--env", default="studio.env")
    ap.add_argument("--apply", action="store_true"); ap.add_argument("--delete", action="store_true")
    ap.add_argument("--publish", action="store_true"); ap.add_argument("--map", default="build.json")
    a = ap.parse_args()
    spec = json.load(open(a.spec)); env = load_env(a.env); st = Studio(env)
    root = "block-v1:" + a.course[len("course-v1:"):] + "+type@course+block@course"
    live = st.outline(root)
    comp_by_unit = {u["id"]: u["children"] for u in st.units(a.course)}
    plan, changed_units, book = [], [], {}
    write = a.apply

    def act(kind, path, locator, fn):
        plan.append(f"{kind:8} {path}" + (f"  [{locator[-12:]}]" if locator else ""))
        return fn() if write else None

    def reorder(parent, ids):
        if ids and write:
            st.update(parent, {"children": ids})

    sec_pairs, sec_extra = match(spec["section"], children(live), lambda n: n["display_name"])
    sec_ids = []
    for s, ls in sec_pairs:
        sid = ls["id"] if ls else act("create", s["name"], "", lambda: st.create(root, "chapter", s["name"]))
        sec_ids.append(sid); book[s["name"]] = sid
        sub_pairs, sub_extra = match(s.get("subsection", []), children(ls) if ls else [], lambda n: n["display_name"])
        sub_ids = []
        for ss, lss in sub_pairs:
            path = f"{s['name']} / {ss['name']}"
            ssid = lss["id"] if lss else act("create", path, "", lambda: st.create(sid, "sequential", ss["name"]))
            sub_ids.append(ssid); book[path] = ssid
            if ss.get("graderType") and (not lss or lss.get("format") != ss["graderType"]):
                act("grade", path, ssid, lambda: st.update(ssid, {"graderType": ss["graderType"]}))
            unit_pairs, unit_extra = match(ss.get("unit", []), children(lss) if lss else [], lambda n: n["display_name"])
            unit_ids = []
            for u, lu in unit_pairs:
                upath = f"{path} / {u['name']}"
                uid = lu["id"] if lu else act("create", upath, "", lambda: st.create(ssid, "vertical", u["name"]))
                unit_ids.append(uid); book[upath] = uid
                unit_changed = lu is None
                live_comps = comp_by_unit.get(uid, []) if lu else []
                cpairs, cextra = match(
                    [dict(p, name=p.get("display_name") or p.get("metadata", {}).get("display_name") or p["problem_type"]) for p in u.get("problems", [])],
                    [c for c in live_comps], lambda c: c["display_name"])
                comp_ids = []
                for p, lc in cpairs:
                    cat = CATEGORY.get(p["problem_type"])
                    cpath = f"{upath} / {p['name']}"
                    if not cat:
                        plan.append(f"skip     {cpath}  (problem_type {p['problem_type']} not handled — use the pdf/other skill)"); continue
                    if lc and lc["type"] != cat:
                        lc = None  # same name, different type → create anew
                    if lc is None:
                        cid = act("create", cpath, "", lambda: st.create(uid, cat, p["name"]))
                        if write: st.update(cid, component_body(p))
                        unit_changed = True
                    else:
                        cid = lc["id"]
                        current = st.block(cid)
                        want = component_body(p)
                        same = (want.get("data") is None or (current.get("data") or "") == want["data"]) and all(
                            (current.get("metadata") or {}).get(k) == v for k, v in want["metadata"].items())
                        if not same:
                            act("update", cpath, cid, lambda: st.update(cid, want)); unit_changed = True
                    comp_ids.append(cid); book[cpath] = cid
                for lc in cextra:
                    if a.delete:
                        act("delete", f"{upath} / {lc['display_name']}", lc["id"], lambda: st.delete(lc["id"])); unit_changed = True
                    else:
                        plan.append(f"extra    {upath} / {lc['display_name']}  [{lc['id'][-12:]}] (kept; --delete removes)")
                if lu and comp_ids and [c["id"] for c in live_comps if c["id"] in comp_ids] != comp_ids:
                    act("reorder", upath, uid, lambda: reorder(uid, comp_ids))
                if unit_changed: changed_units.append((upath, uid))
            for lu in unit_extra:
                if a.delete: act("delete", f"{path} / {lu['display_name']}", lu["id"], lambda: st.delete(lu["id"]))
                else: plan.append(f"extra    {path} / {lu['display_name']}  [{lu['id'][-12:]}] (kept; --delete removes)")
            if lss and [c["id"] for c in children(lss) if c["id"] in unit_ids] != unit_ids:
                act("reorder", path, ssid, lambda: reorder(ssid, unit_ids))
        for lss in sub_extra:
            if a.delete: act("delete", f"{s['name']} / {lss['display_name']}", lss["id"], lambda: st.delete(lss["id"]))
            else: plan.append(f"extra    {s['name']} / {lss['display_name']}  [{lss['id'][-12:]}] (kept; --delete removes)")
        if ls and [c["id"] for c in children(ls) if c["id"] in sub_ids] != sub_ids:
            act("reorder", s["name"], sid, lambda: reorder(sid, sub_ids))
    for ls in sec_extra:
        if a.delete: act("delete", ls["display_name"], ls["id"], lambda: st.delete(ls["id"]))
        else: plan.append(f"extra    {ls['display_name']}  [{ls['id'][-12:]}] (kept; --delete removes)")
    if [c["id"] for c in children(live) if c["id"] in sec_ids] != sec_ids:
        act("reorder", "<course>", root, lambda: reorder(root, sec_ids))
    if a.publish and write:
        for upath, uid in changed_units:
            act("publish", upath, uid, lambda: st.update(uid, {"publish": "make_public"}))

    print("\n".join(plan) or "no changes")
    print(f"\n{'applied' if write else 'dry run'}: {len(plan)} actions, {len(changed_units)} units changed, {st.calls} API calls")
    if write:
        json.dump(book, open(a.map, "w"), indent=1)
        print(f"locator map → {a.map}")
    elif plan:
        print("re-run with --apply (and --publish / --delete as intended)")


if __name__ == "__main__":
    main()
