# Course access — component props, hooks, contexts, custom routing

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## `<CourseContentLayout>` Props

Next-specific. Owns `CourseOutlineContext` + `EdxIframeContext`.

### Required

| Prop | Type | Description |
|------|------|-------------|
| `courseId` | `string` | edX course id (the `[course_id]` path param) |
| `isPlatformAdmin` | `boolean` | Whether the viewer is an admin on the current organization (gates the `instructor` tab) |
| `currentTenant` | `string` | Organization / platform key the viewer operates in |
| `dmUrl` | `string` | DM base URL (`config.dmUrl()`) — used to build the Stripe `success_url` |
| `children` | `ReactNode` | Per-tab content (typically a `CourseContentTabPage`) |

### Optional

| Prop | Type | Description |
|------|------|-------------|
| `tabHrefTemplate` | `(args: { courseId: string; tab: string }) => string` | Override the per-tab `href`. Defaults to `/course-content/${courseId}/${routeSegment}` |
| `onUnauthorized` | `() => void` | Fired when the viewer's organization can't see the course |
| `onNotFound` | `() => void` | Fired when the course fetch fails |
| `onNavigate` | `(href: string, opts?: { external?: boolean }) => void` | Wires lesson open, access course, and Stripe checkout redirects |
| `onError` | `(message: string) => void` | Toaster hook for failures |
| `onSuccess` | `(message: string) => void` | Toaster hook for successes |
| `courseEligibilityEnabled` | `boolean` | Opt into the richer eligibility branch (Enroll Now / Buy Now / Request Access) |
| `onCourseMentorChange` | `(mentorUuid: string \| null) => void` | Fires when the fetched course exposes a `mentor_uuid` and isn't `mentor_hidden` — wire to your chat widget |

## `<CourseContentTabPage>` Props

Next-specific. Renders `<EdxIframe />` inside the layout's
`EdxIframeContext` and sets the active tab.

| Prop | Type | Description |
|------|------|-------------|
| `tab` | `"course" \| "dates" \| "progress" \| "bookmarks" \| "forum" \| "instructor"` | Which edX tab this page represents |
| `lmsUrl` | `string` | edX LMS host (`config.legacyLmsUrl()` — not the consolidated API base) |
| `mfeUrl` | `string` | Learner MFE host (`config.mfeUrl()`) |
| `legacyLmsUrl` | `string` | Legacy LMS base URL |
| `edxTokenKey` | `string?` | localStorage key for the edX JWT token. Defaults to `"edx_jwt_token"` |
| `sandbox` | `string?` | iframe `sandbox` attribute. Defaults to the permissive set for the learning MFE |

## `<EdxIframe>` Props

Next-specific. Used directly only if you render the iframe outside the
standard tab page flow. Otherwise, prefer `CourseContentTabPage`.

Same props as `CourseContentTabPage` minus `tab`.

## `<CourseOutline>` Props

Framework-agnostic. Reads everything from `CourseOutlineContext` — no
props. Rendered automatically by `CourseContentLayout` (desktop sidebar +
mobile drawer). Use it directly only if you build a custom layout; wrap it
in a `<CourseOutlineContext.Provider value={...} />`.

## `<CourseOutlineDrawer>` Props

Framework-agnostic. Mobile drawer wrapping `CourseOutline` in a `Sheet`.
Also context-driven — no props.

## `<CourseAccessGuard>` Props

Framework-agnostic. Gates children on a clean authorized load. Used
internally by `CourseContentLayout` but exposed for custom shells.

| Prop | Type | Description |
|------|------|-------------|
| `course` | `CourseEdxData \| null` | From `useCourseDetail` |
| `courseInfoLoadingState` | `"not-started" \| "loading" \| "successful" \| "failure"` | From `useCourseDetail` |
| `currentTenant` | `string` | Platform key the viewer operates in |
| `onUnauthorized` | `() => void` | Fires once when the course's `platform_key` is neither `"main"` nor `currentTenant` |
| `onNotFound` | `() => void` | Fires once when the course fetch fails |
| `children` | `ReactNode` | Rendered only on a clean authorized load |

Wrap `onUnauthorized` / `onNotFound` in `useCallback` (or hoist to module
scope) to avoid spurious re-fires.

## `<TimedExam>` Props

Framework-agnostic. Renders the timed-exam blocker overlay when the current
subsection is a proctored exam. Reads from `EdxIframeContext` — no props.
Rendered automatically by `EdxIframe`.

## `<CourseContentLoading>` Props

Framework-agnostic. Full-height spinner skeleton. No props. Use as a
Next `loading.tsx` export:

```tsx
// app/(app)/course-content/[course_id]/loading.tsx
"use client";
import { CourseContentLoading } from "@iblai/iblai-js/web-containers";
export default CourseContentLoading;
```

## Hooks

All framework-agnostic (import from `@iblai/iblai-js/web-containers`).

### `useCourseDetail({ courseId, dmUrl, courseEligibilityEnabled?, onNavigate?, onError?, onSuccess? })`

Returns the fetched course metadata, outline, completion, progress,
grading policy, and a set of handlers (`handleFetchCourseInfo`,
`handleFetchCourseSyllabus`, `handleOpenLesson`, `handleFetchCourseProgress`,
`handleFetchCourseCompletion`, `handleCourseAction`, etc.). Used
internally by `CourseContentLayout` — you typically don't call it
yourself.

### `useEdxIframe({ lmsUrl, mfeUrl, legacyLmsUrl })`

Returns `getIframeURL`, `findSequentialParent`, `getUnitToIframe`, and
`getParentsInfosFromSublessonId`. Used internally by `EdxIframe`.

### `useCourseNavigator(courseOutline, currentUnitId)`

Returns a `navigator` with `moveToPrevious()`, `moveToNext()`,
`isPreviousHidden()`, `isNextHidden()`, plus the flattened
`thirdLevelChildren` index. Used internally by `EdxIframe` for the
previous / next unit buttons.

## Contexts

Both framework-agnostic.

### `CourseOutlineContext`

Exposes `courseOutline`, `courseOutlineLoading`, `expandedModule`,
`expandedLessons`, `selectLesson`, `toggleModule`, `toggleLesson`,
`currentChapter`, `currentLesson`, `course`, `courseOutlineDrawerOpen`,
`setCourseOutlineDrawerOpen`, `currentUnitID`, `refetchCourseOutline`.
Set up by `CourseContentLayout`.

### `EdxIframeContext`

Exposes `iframeUrl`, `setIframeUrl`, `courseOutline`, `activeTab`,
`setActiveTab`, `courseID`, `currentlyInExamSubsection`,
`setCurrentlyInExamSubsection`, `examInfo`, `setExamInfo`, `refresher`,
`setRefresher`. Set up by `CourseContentLayout`.

## Custom Routing

If your app doesn't live at `/course-content/[course_id]`, override
`tabHrefTemplate`:

```tsx
<CourseContentLayout
  // ...
  tabHrefTemplate={({ courseId, tab }) => {
    const segmentMap: Record<string, string> = {
      course: "content",
      progress: "progress",
      dates: "schedule",
      forum: "discussion",
      instructor: "admin",
    };
    return `/learn/${courseId}/${segmentMap[tab] ?? tab}`;
  }}
>
  {children}
</CourseContentLayout>
```

The tab *value* passed to `CourseContentTabPage` stays the same
(e.g. `"forum"`); only the route segment changes.
