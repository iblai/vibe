# Profile — content API, hooks, career/resume backend, MediaBox

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Profile Content API

Full REST reference: [`/iblai-api-profile`](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile/SKILL.md)
in [`iblai/api`](https://github.com/iblai/api) (`npx skills add iblai/api`).

The SDK `Profile` component handles all API calls internally. If you need
to build custom profile UIs or interact with profile data programmatically,
here are the APIs each tab uses.

**Read before write.** When calling these REST endpoints directly (e.g.
via `fetch` or `curl`), always GET the current data first, merge your
changes into it, then POST/PUT the full object back. Most endpoints
replace the entire resource -- they do NOT merge fields. Skipping the
read will silently erase fields you didn't include in the payload.

```bash
# 1. Read current state
curl -s "{dmUrl}/api/career/orgs/{org}/education/users/alice/" \
  -H "Authorization: Token {dm_token}" > education.json

# 2. Merge your changes into the existing data
# 3. Write back the full object
curl -X PUT "{dmUrl}/api/career/orgs/{org}/education/users/alice/?id={education_id}" \
  -H "Authorization: Token {dm_token}" \
  -H "Content-Type: application/json" \
  -d @education.json
```

This applies to all profile endpoints: education, experience, and resume.

### Service

Profile data lives in the DM (data manager) service:

| Service | Base URL | Auth Header | Manages |
|---------|----------|-------------|---------|
| **DM** | `config.dmUrl()` | `Authorization: Token {dm_token}` | Education, experience, companies, institutions, resume |

### Basic, Social, and Profile Image

Basic info (name, email, title, bio, language), social links, profile
image, and password reset are user-scope and not exposed via the
platform Api-Token. Use the SDK `Profile` component, which handles
these via the user's session — no direct REST endpoints are documented
here.

### Education Tab

CRUD operations for education entries. Uses the DM career API.

```
GET    {dmUrl}/api/career/orgs/{org}/education/users/{username}/
POST   {dmUrl}/api/career/orgs/{org}/education/users/{username}/
PUT    {dmUrl}/api/career/orgs/{org}/education/users/{username}/?id={education_id}
DELETE {dmUrl}/api/career/orgs/{org}/education/users/{username}/?id={education_id}
```

**Education schema:**
```typescript
{
  id: number;
  institution: { id: number; name: string };
  institution_id: number;        // required for create/update
  degree: string;
  field_of_study: string;
  start_date: string;            // "YYYY-MM-DD"
  end_date: string | null;
  is_current: boolean;
  grade: string;
  activities: string;
  description: string;
  data: Record<string, any>;     // arbitrary metadata
  metadata: Record<string, any>;
}
```

**Institutions** (lookup for the institution picker):
```
GET  {dmUrl}/api/career/orgs/{org}/institutions/users/{username}/
POST {dmUrl}/api/career/orgs/{org}/institutions/users/{username}/
```

Institution create payload:
```typescript
{ name: string; institution_type: InstitutionTypeEnum; established_year?: number }
```

### Experience Tab

CRUD operations for professional experience entries.

```
GET    {dmUrl}/api/career/orgs/{org}/experience/users/{username}/
POST   {dmUrl}/api/career/orgs/{org}/experience/users/{username}/
PUT    {dmUrl}/api/career/orgs/{org}/experience/users/{username}/?id={experience_id}
DELETE {dmUrl}/api/career/orgs/{org}/experience/users/{username}/?id={experience_id}
```

**Experience schema:**
```typescript
{
  id: number;
  company: { id: number; name: string };
  company_id: number;            // required for create/update
  title: string;
  employment_type: string;       // "Full-time", "Part-time", "Contract", "Freelance", "Internship"
  location: string;
  start_date: string;            // "YYYY-MM-DD"
  end_date: string | null;
  is_current: boolean;
  description: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
}
```

**Companies** (lookup for the company picker):
```
GET  {dmUrl}/api/career/orgs/{org}/companies/users/{username}/
POST {dmUrl}/api/career/orgs/{org}/companies/users/{username}/
```

Company create payload:
```typescript
{ name: string; industry?: string; website?: string; logo_url?: string }
```

### Resume Tab

Upload and view PDF resumes.

```
GET  {dmUrl}/api/career/resume/orgs/{org}/users/{username}/
POST {dmUrl}/api/career/resume/orgs/{org}/users/{username}/
PUT  {dmUrl}/api/career/resume/orgs/{org}/users/{username}/
```

**Upload** (FormData):
```
user: {username}
platform: {org}
resume: File          // PDF only, max 25MB -- marks as CV
additional_files: File  // general file upload (not CV)
```

**Response:**
```typescript
{
  id: number;
  user: number;
  platform: string;
  files: [{ name: string; url: string; type: string }];
  links: [{ url: string }];
}
```

### Security Tab

Account deletion.

```
POST {dmUrl}/api/core/users/delete/          // account deletion (self-retire)
```

Account deletion payload: `{ username: string }`. Password reset is
user-scope and runs through the SDK / Auth SPA, not via the platform
Api-Token.

### RTK Query Hooks (SDK Exports)

The SDK's data-layer exports these hooks for all career operations:

```typescript
import {
  useGetUserEducationQuery,
  useCreateUserEducationMutation,
  useUpdateUserEducationMutation,
  useDeleteUserEducationMutation,
  useGetUserExperienceQuery,
  useCreateUserExperienceMutation,
  useUpdateUserExperienceMutation,
  useDeleteUserExperienceMutation,
  useGetUserInstitutionsQuery,
  useCreateUserInstitutionMutation,
  useGetUserCompaniesQuery,
  useCreateUserCompanyMutation,
  useGetUserResumeQuery,
  useCreateUserResumeMutation,
} from "@iblai/iblai-js/data-layer";
```

For user metadata (basic/social):
```typescript
import {
  useGetUserMetadataQuery,
  useUpdateUserMetadataMutation,
  useUploadProfileImageMutation,
  useGetUserMetadataEdxQuery,
  useResetPasswordMutation,
} from "@iblai/iblai-js/data-layer";
```

### Building a Custom Career API Slice

If you need career APIs without the SDK's built-in hooks, build a standard
RTK Query slice with `fetchBaseQuery` and one endpoint per row in the
endpoint tables above. Use `Authorization: Token {dm_token}` (from
localStorage), and tag invalidation on `["education", "experience",
"institution", "company", "resume"]`.

---

## User Metadata API

Full REST reference: [`/iblai-api-profile-metadata`](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile-metadata/SKILL.md)
in [`iblai/api`](https://github.com/iblai/api) (`npx skills add iblai/api`).

The ibl.ai platform provides per-user metadata storage via the **Agent
Metadata** endpoint. This is useful for storing arbitrary JSON data scoped
to a specific user and agent (e.g. application progress, preferences,
onboarding state).

### Endpoints

```
GET  {dmUrl}/api/ai/mentor/orgs/{org}/users/{username}/metadata?mentor={mentorId}
POST {dmUrl}/api/ai/mentor/orgs/{org}/metadata/        body: { mentor_id, metadata }
```

- **Auth**: `Authorization: Token {axd_token}` (from localStorage)
- **Scope**: Per-user, per-agent; isolated.
- **Schema**: Arbitrary JSON.
- **Merge behavior**: POST merges new keys with existing metadata
  (does not replace the entire object).

---

## AI Profile Memory API

The platform stores AI-learned facts about a user as tag/detail pairs.
This powers the "AI Memory" tab in the profile modal.

```
GET    {dmUrl}/api/ai-mentor/orgs/{org}/users/{user_id}/ai-user-profile-memory/
POST   {dmUrl}/api/ai-mentor/orgs/{org}/users/{user_id}/ai-user-profile-memory/
DELETE {dmUrl}/api/ai-mentor/orgs/{org}/users/{user_id}/ai-user-profile-memory/{tag}/
```

**Create/Read:**
```typescript
// Request
{ tag: "favorite-animal", detail: "my favorite animal is cat" }

// Response (array of entries)
[{ tag: "favorite-animal", detail: "my favorite animal is cat" }]
```

**Auth**: Uses `axd_token` from localStorage.

---

## Chat Privacy Settings

Users can control how their chat data is stored.

```
GET  {dmUrl}/api/ai-account/orgs/{org}/users/{user_id}/chat-privacy-config/
GET  {dmUrl}/api/ai-account/orgs/{org}/users/{user_id}/chat-privacy-settings/
POST {dmUrl}/api/ai-account/orgs/{org}/users/{user_id}/chat-privacy-settings/
```

**Privacy modes**: `normal`, `anonymized`, `disabled`

The config endpoint returns whether the platform has this feature enabled.
The settings endpoint reads/writes the user's preference.

---

## Media Upload (MediaBox)

The SDK provides a `MediaBox` component for file and link uploads. It renders
a tabbed interface with a file upload zone and a link input field, plus a
list of previously uploaded files/links.

### Import

```typescript
import { MediaBox, type UploadedFile } from "@iblai/iblai-js/web-containers/next";
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `uploadedMedia` | `UploadedFile[]` | Previously uploaded files/links to display |
| `isLoading` | `boolean?` | Show loading state |
| `isError` | `boolean?` | Show error state |
| `isUploading` | `boolean?` | Show upload-in-progress state |
| `resumeCheckboxEnabled` | `boolean?` | Show "This is my CV" checkbox |
| `onUploadFile` | `(file: File, isResume: boolean) => void` | Called when a file is selected |
| `onUploadLink` | `(url: string) => void` | Called when a link is submitted |
| `onError` | `(message: string) => void` | Called on validation errors |

### UploadedFile type

```typescript
interface UploadedFile {
  name: string;
  url: string;
  type?: string;  // "link" for links, MIME type for files
}
```

### Peer dependency

MediaBox requires `@tanstack/react-form`:

```bash
pnpm add @tanstack/react-form
```

### Backend: Career/Resume API

MediaBox is a presentational component -- it does not handle uploads itself.
You must connect it to the Career/Resume API for persistent storage:

```
GET/PUT/POST  /api/career/resume/orgs/{org}/users/{username}/
```

#### Connecting MediaBox to the Career API

```tsx
import { useMemo } from "react";
import { toast } from "sonner";
import { MediaBox, type UploadedFile } from "@iblai/iblai-js/web-containers/next";
import { useGetUserResumeQuery, useCreateUserResumeMutation } from "@/services/career-api";
import { resolveAppTenant } from "@/lib/iblai/tenant";

function getUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("userData");
    return raw ? JSON.parse(raw).user_nicename ?? "" : "";
  } catch { return ""; }
}

export function DocumentUploads() {
  const org = useMemo(() => resolveAppTenant(), []);
  const username = useMemo(() => getUserName(), []);

  const { data, isLoading, isError, refetch } = useGetUserResumeQuery(
    { org, username },
    { skip: !org || !username }
  );
  const [createResume, { isLoading: isUploading }] = useCreateUserResumeMutation();

  const uploadedMedia: UploadedFile[] = useMemo(() => {
    if (!data) return [];
    const files = (data.files ?? []).map((f) => ({ name: f.name, url: f.url, type: f.type }));
    const links = (data.links ?? []).map((l) => ({ name: l.url, url: l.url, type: "link" }));
    return [...files, ...links];
  }, [data]);

  async function handleUploadFile(file: File, isResume: boolean) {
    const formData = new FormData();
    formData.append("user", username);
    formData.append("platform", org);
    formData.append(isResume ? "resume" : "additional_files", file);
    try {
      await createResume({ org, username, resume: formData, method: "POST" }).unwrap();
      toast.success("File uploaded successfully");
      refetch();
    } catch { toast.error("Failed to upload file"); }
  }

  async function handleUploadLink(url: string) {
    const formData = new FormData();
    formData.append("user", username);
    formData.append("platform", org);
    const existingLinks = data?.links ?? [];
    existingLinks.forEach((link, index) => {
      formData.append(`link_${existingLinks.length + 1 - index}`, link.url);
    });
    formData.append("link_1", url);
    try {
      await createResume({ org, username, resume: formData }).unwrap();
      toast.success("Link added successfully");
      refetch();
    } catch { toast.error("Failed to add link"); }
  }

  if (!org || !username) {
    return <p className="text-[14px] text-[#86868b]">Please sign in to upload documents.</p>;
  }

  return (
    <MediaBox
      uploadedMedia={uploadedMedia}
      isLoading={isLoading}
      isError={isError}
      isUploading={isUploading}
      resumeCheckboxEnabled={true}
      onUploadFile={handleUploadFile}
      onUploadLink={handleUploadLink}
      onError={(msg) => toast.error(msg)}
    />
  );
}
```

#### Key details

- **Auth**: Uses `dm_token` from localStorage (NOT `axd_token`)
- **FormData fields**: `user` (username), `platform` (org key),
  `resume` (file, marks as CV) or `additional_files` (file, general upload)
- **Links**: Append numbered `link_N` fields. Preserve existing links when
  adding a new one
- **Persistent**: Files are stored on the user's profile permanently
  (unlike chat file uploads which are session-scoped)

## Career Profile Tabs (Standalone)

The SDK also exports individual career profile tabs that can be used
outside the full `Profile` component:

### ResumeTab

```typescript
import { ResumeTab } from "@iblai/iblai-js/web-containers";
<ResumeTab org={tenantKey} username={username} />
```

Renders a resume upload and display interface. Props: `org` (string),
`username` (string).

### EducationTab

```typescript
import { EducationTab } from "@iblai/iblai-js/web-containers";
<EducationTab org={tenantKey} username={username} />
```

Renders education background management (add/edit/delete education entries).
Props: `org` (string), `username` (string).

### ExperienceTab

```typescript
import { ExperienceTab } from "@iblai/iblai-js/web-containers";
<ExperienceTab org={tenantKey} username={username} />
```

Renders professional experience management. Props: `org` (string),
`username` (string).

### Dialogs

These companion dialogs can be used alongside the tabs:

| Component | Import | Description |
|-----------|--------|-------------|
| `EducationDialog` | `@iblai/iblai-js/web-containers` | Dialog for adding/editing education entries |
| `ExperienceDialog` | `@iblai/iblai-js/web-containers` | Dialog for adding/editing experience entries |
| `CompanyDialog` | `@iblai/iblai-js/web-containers` | Company selection dialog |
| `InstitutionDialog` | `@iblai/iblai-js/web-containers` | Institution selection dialog |
